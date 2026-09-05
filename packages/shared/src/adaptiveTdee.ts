import type { Profile } from './types';
import { addDaysISO, calcTDEE } from './calc';

/** Energy in roughly a kilogram of body mass — same figure planDailyTargets plans against. */
const KCAL_PER_KG = 7700;

/** How far back to look. Long enough to average out water weight, short enough to track change. */
export const ADAPTIVE_WINDOW_DAYS = 28;

/** Below these we don't have enough signal and return null rather than guessing. */
const MIN_WEIGH_INS = 8;
const MIN_SPAN_DAYS = 14;
const MIN_INTAKE_DAYS = 10;

/**
 * Fraction of the measured span that must have a credible intake log.
 *
 * This is the safety-critical guard, not a quality nicety. Unlogged days are almost always
 * days someone ate *more*, so the mean of the logged days understates true intake while the
 * weight trend still reflects everything eaten. That biases the estimate downward — and a
 * downward-biased maintenance number tells someone who is already under-eating to eat less
 * again. Requiring most of the window to be logged is what keeps that feedback loop shut.
 */
const MIN_COVERAGE = 0.7;

/**
 * A day logging less than this is treated as a partial log (breakfast entered, rest forgotten)
 * rather than a real day of eating, and excluded. It counts against coverage, so a run of them
 * suppresses the estimate instead of skewing it.
 */
const MIN_CREDIBLE_DAILY_KCAL = 1000;

/**
 * How far the measurement may move the target away from the formula, as a fraction.
 *
 * Mifflin-St Jeor is commonly 10–20% off for an individual, which is the whole reason to
 * measure. It is not 50% off. A result that far out means the inputs are wrong — a misremembered
 * scale, a bulk import, a unit mix-up — so the estimate is clamped and flagged rather than
 * trusted. planDailyTargets' calorie floor is the second net under this one.
 */
const MAX_DEVIATION = 0.3;

export interface AdaptiveTDEEResult {
  /** Measured maintenance calories per day, after clamping. */
  tdee: number;
  /** What the Mifflin-St Jeor formula predicted, for comparison. */
  formulaTdee: number;
  /** Days between the first and last weigh-in used. */
  spanDays: number;
  /** Weigh-ins the trend was fitted through. */
  weighIns: number;
  /** Days with a credible intake log inside the span. */
  intakeDays: number;
  /** Mean daily intake across those days. */
  meanIntake: number;
  /** Fitted weight change per week over the span (negative = losing). */
  observedWeeklyChangeKg: number;
  /** True when the raw measurement fell outside MAX_DEVIATION and was pulled back. */
  clamped: boolean;
}

/** Reasons an estimate isn't available yet, so the UI can say which rather than staying blank. */
export type AdaptiveTDEEGap =
  | 'not_enough_weigh_ins'
  | 'span_too_short'
  | 'not_enough_intake_days'
  | 'intake_coverage_too_low';

export interface AdaptiveTDEEUnavailable {
  reason: AdaptiveTDEEGap;
  /** How many more of the missing thing are needed, where that's a countable number. */
  shortfall: number;
}

/**
 * Least-squares slope of weight against day offset, in kg/day.
 *
 * Endpoint-to-endpoint would be far simpler and much worse: day-to-day weight swings by 1–2kg
 * on water and glycogen alone, which dwarfs the ~0.25kg/week a plan is actually aiming for, so
 * whichever two days happened to sit at the ends would dominate the answer. Fitting through
 * every weigh-in is what makes the trend mean something.
 */
function weightSlopeKgPerDay(points: { dayOffset: number; weightKg: number }[]): number {
  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.dayOffset, 0) / n;
  const meanY = points.reduce((s, p) => s + p.weightKg, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (const p of points) {
    const dx = p.dayOffset - meanX;
    numerator += dx * (p.weightKg - meanY);
    denominator += dx * dx;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Whole days between two YYYY-MM-DD dates. Date.parse treats a bare date string as UTC midnight,
 * so the difference is exact and independent of the device's timezone — the same reason
 * addDaysISO does its arithmetic in UTC.
 */
function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86_400_000);
}

/**
 * Measure what the user actually maintains on, instead of predicting it from their body.
 *
 * Mifflin-St Jeor estimates maintenance from height, weight, age and a self-reported activity
 * multiplier. The multiplier in particular is a guess about a guess, and the result is routinely
 * a few hundred calories off for any given person — which is enough to make a plan quietly fail
 * for months while every number on screen looks right.
 *
 * Energy balance gives the honest answer once there's history to read: whatever someone ate on
 * average, minus the energy their weight trend says they banked or spent, is what they burn.
 * Unlike the formula this gets *more* accurate the longer the app is used, and it needs no new
 * input from the user beyond the weigh-ins and meals they are already logging.
 *
 * Returns null-shaped `AdaptiveTDEEUnavailable` rather than a low-confidence number: a wrong
 * maintenance figure is worse than no figure, because the whole plan is built on it.
 */
export function estimateAdaptiveTDEE(
  profile: Profile,
  weights: { date: string; weightKg: number }[],
  intakeByDate: { date: string; calories: number }[],
  today: string
): AdaptiveTDEEResult | AdaptiveTDEEUnavailable {
  const windowStart = addDaysISO(today, -ADAPTIVE_WINDOW_DAYS);

  const inWindow = weights
    .filter((w) => w.date >= windowStart && w.date <= today && Number.isFinite(w.weightKg) && w.weightKg > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (inWindow.length < MIN_WEIGH_INS) {
    return { reason: 'not_enough_weigh_ins', shortfall: MIN_WEIGH_INS - inWindow.length };
  }

  const first = inWindow[0];
  const last = inWindow[inWindow.length - 1];
  const spanDays = daysBetween(first.date, last.date);
  if (spanDays < MIN_SPAN_DAYS) {
    return { reason: 'span_too_short', shortfall: MIN_SPAN_DAYS - spanDays };
  }

  const slopeKgPerDay = weightSlopeKgPerDay(
    inWindow.map((w) => ({ dayOffset: daysBetween(first.date, w.date), weightKg: w.weightKg }))
  );

  // Intake is only meaningful over the same stretch the weight trend was fitted through —
  // pairing a month of eating with a week of weigh-ins would compare two different periods.
  const credible = intakeByDate.filter(
    (d) => d.date >= first.date && d.date <= last.date && d.calories >= MIN_CREDIBLE_DAILY_KCAL
  );

  if (credible.length < MIN_INTAKE_DAYS) {
    return { reason: 'not_enough_intake_days', shortfall: MIN_INTAKE_DAYS - credible.length };
  }

  // Inclusive of both endpoints: a span of 14 days covers 15 calendar days of eating.
  const daysInSpan = spanDays + 1;
  const coverage = credible.length / daysInSpan;
  if (coverage < MIN_COVERAGE) {
    return {
      reason: 'intake_coverage_too_low',
      shortfall: Math.ceil(MIN_COVERAGE * daysInSpan) - credible.length,
    };
  }

  const meanIntake = credible.reduce((s, d) => s + d.calories, 0) / credible.length;

  // Energy balance: what went in, minus what the body banked (or released), is what was burned.
  const bankedPerDay = slopeKgPerDay * KCAL_PER_KG;
  const raw = meanIntake - bankedPerDay;

  const formulaTdee = calcTDEE(profile);
  const lower = formulaTdee * (1 - MAX_DEVIATION);
  const upper = formulaTdee * (1 + MAX_DEVIATION);
  const tdee = Math.min(upper, Math.max(lower, raw));

  return {
    tdee: Math.round(tdee),
    formulaTdee: Math.round(formulaTdee),
    spanDays,
    weighIns: inWindow.length,
    intakeDays: credible.length,
    meanIntake: Math.round(meanIntake),
    observedWeeklyChangeKg: slopeKgPerDay * 7,
    clamped: tdee !== raw,
  };
}

/** Narrows the union — `estimateAdaptiveTDEE` returns one or the other. */
export function isAdaptiveTDEE(
  result: AdaptiveTDEEResult | AdaptiveTDEEUnavailable
): result is AdaptiveTDEEResult {
  return 'tdee' in result;
}
