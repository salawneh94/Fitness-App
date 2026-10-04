import { addDaysISO } from './calc';
import { daysBetween, robustLine } from './trend';

/** Same window and evidence floors as the insights, so the forecast and the coach never disagree
 * about whether there's enough data to say anything. */
export const FORECAST_WINDOW_DAYS = 28;
const MIN_WEIGH_INS = 8;
const MIN_SPAN_DAYS = 14;

/** Under this much movement a week the trend is noise, not a direction. Mirrors the stall insight. */
const STALL_KG_PER_WEEK = 0.1;
/** Within this of the target counts as there — scales don't agree with each other more closely. */
const ARRIVED_KG = 0.5;
/** Pace within ±25% of the plan is "on track"; outside it is ahead or behind. */
const PACE_TOLERANCE = 0.25;
/** Beyond two years a date is a guess, and a discouraging one; say "slowly" instead. */
const MAX_FORECAST_WEEKS = 104;

export type ForecastStatus = 'reached' | 'on_track' | 'ahead' | 'behind' | 'stalled' | 'wrong_way';

export interface GoalForecast {
  status: ForecastStatus;
  /** Where the fitted trend puts the user today — steadier than any single weigh-in. */
  trendKg: number;
  /** Fitted change per week over the window (negative = losing). */
  observedKgPerWeek: number;
  /** What the plan aims for, signed the same way. */
  plannedKgPerWeek: number;
  /** Target minus trend weight (negative = still to lose). */
  remainingKg: number;
  /** Weeks to the target at the observed pace — only when the trend is heading there, and not absurdly far off. */
  etaWeeks: number | null;
  /** The date that lands on. */
  etaDate: string | null;
  weighIns: number;
  spanDays: number;
}

/**
 * When will I get there, going the way I'm actually going?
 *
 * The plan's own projection ("about 12 weeks") is a promise made on day one from a formula. This is
 * the measured answer: a line fitted through the last four weeks of weigh-ins, extended to the
 * target. Fitting, rather than reading the newest weigh-in, matters because a day's water swing is
 * bigger than a week's real change — and the fit is a robust one (see robustLine), because with
 * least squares a single heavy morning moved the date by seven weeks.
 *
 * Returns null without a target or without enough weigh-ins: a forecast from three readings would
 * be confidently wrong, and for a goal like this one being quiet costs nothing.
 */
export function forecastGoal(
  targetWeightKg: number | null | undefined,
  plannedKgPerWeek: number,
  weights: { date: string; weightKg: number }[],
  today: string
): GoalForecast | null {
  if (targetWeightKg == null || !Number.isFinite(targetWeightKg)) return null;

  const from = addDaysISO(today, -FORECAST_WINDOW_DAYS);
  const inWindow = weights
    .filter((w) => w.date >= from && w.date <= today && Number.isFinite(w.weightKg) && w.weightKg > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (inWindow.length < MIN_WEIGH_INS) return null;

  const first = inWindow[0].date;
  const spanDays = daysBetween(first, inWindow[inWindow.length - 1].date);
  if (spanDays < MIN_SPAN_DAYS) return null;

  const line = robustLine(inWindow.map((w) => ({ dayOffset: daysBetween(first, w.date), value: w.weightKg })));
  if (line === null) return null;
  const slope = line.slopePerDay;
  const trendKg = line.intercept + slope * daysBetween(first, today);

  const observedKgPerWeek = slope * 7;
  const remainingKg = targetWeightKg - trendKg;
  const base = { trendKg, observedKgPerWeek, plannedKgPerWeek, remainingKg, weighIns: inWindow.length, spanDays };

  if (Math.abs(remainingKg) <= ARRIVED_KG) return { ...base, status: 'reached', etaWeeks: null, etaDate: null };
  if (Math.abs(observedKgPerWeek) < STALL_KG_PER_WEEK) return { ...base, status: 'stalled', etaWeeks: null, etaDate: null };

  // Pace toward the target: positive when heading there, whichever direction "there" is.
  const toward = observedKgPerWeek * Math.sign(remainingKg);
  if (toward <= 0) return { ...base, status: 'wrong_way', etaWeeks: null, etaDate: null };

  const weeks = Math.abs(remainingKg) / toward;
  const etaWeeks = weeks <= MAX_FORECAST_WEEKS ? Math.max(1, Math.round(weeks)) : null;
  const etaDate = etaWeeks === null ? null : addDaysISO(today, Math.round(weeks * 7));

  // Compared with the plan only when the plan is aiming somewhere; a maintenance plan with a
  // stray target has no pace to be ahead of.
  const planned = plannedKgPerWeek * Math.sign(remainingKg);
  let status: ForecastStatus = 'on_track';
  if (planned > 0.01) {
    const ratio = toward / planned;
    if (ratio > 1 + PACE_TOLERANCE) status = 'ahead';
    else if (ratio < 1 - PACE_TOLERANCE) status = 'behind';
  }
  return { ...base, status, etaWeeks, etaDate };
}
