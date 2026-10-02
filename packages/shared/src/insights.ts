import type { FoodEntry, Profile, UnitSystem, WorkoutLogEntry } from './types';
import { addDaysISO, planDailyTargets, SLEEP_GOAL_HOURS } from './calc';
import { daysBetween, slopePerDay } from './trend';
import { deloadWeight } from './progression';
import { findExercise } from './data/exercises';
import { displayWeight, weightUnitLabel } from './units';
import { PLAN_TEMPLATES } from './data/planTemplates';
import { planBlock } from './planProgress';
import { cardioMinutes } from './cardio';

/** Matches the adaptive-TDEE window, so the two features never describe different periods. */
export const INSIGHT_WINDOW_DAYS = 28;

/** Below this a day's food log is a partial entry, not a record of what someone ate. */
const MIN_CREDIBLE_DAILY_KCAL = 1000;

/** Evidence floors. An insight that fires on three data points is a guess wearing a coach's hat. */
const MIN_LOGGED_DAYS = 10;
const MIN_WEIGH_INS = 8;
const MIN_TREND_SPAN_DAYS = 14;
const MIN_STALL_SPAN_DAYS = 21;
const MIN_SLEEP_NIGHTS = 10;
const MIN_STALLED_SESSIONS = 3;

/** Counting a protein day as a hit needs a little slack — nobody lands exactly on target. */
const PROTEIN_HIT_FRACTION = 0.85;
/** Hitting protein on fewer than this share of days is worth mentioning. */
const PROTEIN_CONCERN_RATE = 0.4;

/** Weekly loss beyond this fraction of bodyweight costs lean mass. Mirrors planDailyTargets. */
const MAX_SAFE_LOSS_RATE = 0.01;
/** Under this much movement a week, a weight goal is not progressing. */
const STALL_KG_PER_WEEK = 0.1;
/** Adherence worth congratulating. */
const STRONG_ADHERENCE = 0.8;
/** WHO's baseline for adults: 150 minutes of moderate aerobic activity a week. */
const CARDIO_BASELINE_MIN_PER_WEEK = 150;
/** Two weeks — long enough that one busy week doesn't trigger it. */
const CARDIO_WINDOW_DAYS = 14;

/** Share of a block's sessions that must actually have been trained to call the block finished. */
const MIN_BLOCK_ADHERENCE = 0.5;

export type InsightTone = 'warning' | 'suggestion' | 'win';

export type InsightId =
  | 'losing_too_fast'
  | 'protein_short'
  | 'weight_stalled'
  | 'lift_stalled'
  | 'sleep_short'
  | 'plan_complete'
  | 'cardio_low'
  | 'lift_progressing'
  | 'strong_consistency';

/**
 * The one thing the user can do about an insight, right where they read it.
 *
 * Without this every insight ended at a sentence — "drop about 10% and build back up" — and the
 * user had to go and work out how to do that themselves, which mostly means they didn't.
 */
export type InsightAction =
  | { kind: 'deload'; label: string; exerciseId: string; stalledKg: number; deloadKg: number }
  | { kind: 'protein_foods'; label: string }
  | { kind: 'browse_plans'; label: string }
  | { kind: 'log_cardio'; label: string };

export interface Insight {
  id: InsightId;
  /**
   * Identity of this particular observation, for "not now". A plateau on bench at 80 kg is a
   * different finding from a later one at 85 kg, and dismissing the first mustn't hide the second.
   */
  key: string;
  tone: InsightTone;
  title: string;
  /** One sentence naming the evidence, so the claim is checkable rather than mystical. */
  detail: string;
  /** Lower sorts first. Safety outranks goal-blockers, which outrank praise. */
  priority: number;
  action?: InsightAction;
}

export interface InsightInput {
  profile: Profile;
  foodEntries: FoodEntry[];
  workoutLogs: WorkoutLogEntry[];
  weights: { date: string; weightKg: number }[];
  sleep: { date: string; hours: number }[];
  today: string;
  /** Measured maintenance, when available — insights should agree with the target on screen. */
  measuredTDEE?: number;
}

interface DayIntake {
  date: string;
  calories: number;
  proteinG: number;
}

function intakeByDay(entries: FoodEntry[], from: string, to: string): DayIntake[] {
  const byDate = new Map<string, DayIntake>();
  for (const f of entries) {
    if (f.date < from || f.date > to) continue;
    const day = byDate.get(f.date) ?? { date: f.date, calories: 0, proteinG: 0 };
    day.calories += f.calories * f.quantity;
    day.proteinG += f.proteinG * f.quantity;
    byDate.set(f.date, day);
  }
  // Partial logs would drag every average down, so they're excluded the same way the adaptive
  // TDEE excludes them rather than treated as genuinely tiny days of eating.
  return [...byDate.values()].filter((d) => d.calories >= MIN_CREDIBLE_DAILY_KCAL);
}

/** Fitted bodyweight change per week over the window, or null without enough evidence. */
function weeklyWeightTrend(
  weights: { date: string; weightKg: number }[],
  from: string,
  to: string,
  minSpanDays: number
): { kgPerWeek: number; spanDays: number; count: number } | null {
  const inWindow = weights
    .filter((w) => w.date >= from && w.date <= to && Number.isFinite(w.weightKg) && w.weightKg > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (inWindow.length < MIN_WEIGH_INS) return null;

  const spanDays = daysBetween(inWindow[0].date, inWindow[inWindow.length - 1].date);
  if (spanDays < minSpanDays) return null;

  const slope = slopePerDay(
    inWindow.map((w) => ({ dayOffset: daysBetween(inWindow[0].date, w.date), value: w.weightKg }))
  );
  if (slope === null) return null;
  return { kgPerWeek: slope * 7, spanDays, count: inWindow.length };
}

interface LiftHistory {
  id: string;
  name: string;
  /** Top weight per session, oldest first. */
  sessions: { date: string; topWeightKg: number }[];
}

function liftHistories(logs: WorkoutLogEntry[], from: string, to: string): LiftHistory[] {
  const byExercise = new Map<string, LiftHistory>();
  for (const w of logs) {
    if (w.date < from || w.date > to) continue;
    for (const log of w.exerciseLogs ?? []) {
      if (log.sets.length === 0) continue;
      const top = log.sets.reduce((max, s) => Math.max(max, s.weightKg), 0);
      if (top <= 0) continue; // bodyweight work doesn't progress on load
      const entry = byExercise.get(log.exerciseId) ?? { id: log.exerciseId, name: log.exerciseName, sessions: [] };
      entry.sessions.push({ date: w.date, topWeightKg: top });
      byExercise.set(log.exerciseId, entry);
    }
  }
  for (const entry of byExercise.values()) {
    entry.sessions.sort((a, b) => a.date.localeCompare(b.date));
  }
  return [...byExercise.values()];
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** A load in the user's own unit, trimmed: "80 kg", "72.5 kg", "176.4 lb". */
function load(kg: number, unit: UnitSystem): string {
  return `${Math.round(displayWeight(kg, unit) * 10) / 10} ${weightUnitLabel(unit)}`;
}

/** A weekly rate in the user's unit, to two places: "1.40 kg", "3.09 lb". */
function rate(kg: number, unit: UnitSystem): string {
  return `${displayWeight(kg, unit).toFixed(2)} ${weightUnitLabel(unit)}`;
}

/**
 * Turn the data the app already holds into things worth saying.
 *
 * FitTrack collects intake, training, bodyweight and sleep in one place and, until now, drew
 * exactly one conclusion from the combination (the rest-day nudge). Everything else on screen was
 * playback: your numbers, read back to you. Noticing that protein has been missed for a fortnight
 * while the goal is muscle, or that a lift hasn't moved in a month, is the difference between a
 * spreadsheet and a coach — and it is the part a generic tracker can't copy without holding all
 * four datasets at once.
 *
 * Two rules hold throughout. Every insight states the evidence it rests on, because an
 * unexplained instruction is one the user has no way to evaluate. And nothing fires below a real
 * sample size: being silent is free, while being confidently wrong about someone's body is not.
 *
 * The sentences live here rather than in the UI so they can be tested. They are the feature; a
 * component that stitched them together from ids would put the actual product beyond the reach
 * of the test suite.
 */
export function deriveInsights(input: InsightInput): Insight[] {
  const { profile, foodEntries, workoutLogs, weights, sleep, today, measuredTDEE } = input;
  const unit = profile.unitSystem;
  const from = addDaysISO(today, -INSIGHT_WINDOW_DAYS);
  const insights: Insight[] = [];

  const days = intakeByDay(foodEntries, from, today);
  const targets = planDailyTargets(profile, measuredTDEE);
  const trend = weeklyWeightTrend(weights, from, today, MIN_TREND_SPAN_DAYS);

  // --- Safety first: too fast is a problem regardless of what the user asked for. ---
  if (trend) {
    const maxLossPerWeek = profile.weightKg * MAX_SAFE_LOSS_RATE;
    if (trend.kgPerWeek < -maxLossPerWeek) {
      insights.push({
        id: 'losing_too_fast',
        key: 'losing_too_fast',
        tone: 'warning',
        title: "You're losing weight faster than is sustainable",
        detail: `Down about ${rate(Math.abs(trend.kgPerWeek), unit)} a week over the last ${plural(trend.spanDays, 'day')} — past roughly ${rate(maxLossPerWeek, unit)} a week you start giving up muscle along with fat. Eating a little more would keep the loss and protect the strength.`,
        priority: 0,
      });
    }
  }

  // --- Things blocking the goal the user actually set. ---
  const proteinMatters = profile.goal === 'build_muscle' || profile.goal === 'lose_fat';
  if (proteinMatters && days.length >= MIN_LOGGED_DAYS) {
    const hits = days.filter((d) => d.proteinG >= targets.proteinG * PROTEIN_HIT_FRACTION).length;
    const rate = hits / days.length;
    if (rate < PROTEIN_CONCERN_RATE) {
      const goalPhrase = profile.goal === 'build_muscle' ? 'building muscle' : 'holding onto muscle while losing fat';
      insights.push({
        id: 'protein_short',
        key: 'protein_short',
        tone: 'suggestion',
        title: 'Protein is the gap in your nutrition',
        detail: `You hit your ${targets.proteinG}g target on ${hits} of the last ${plural(days.length, 'logged day')}. Protein is the one macro that limits ${goalPhrase}, and it's the easiest of the three to fix.`,
        priority: 1,
        action: { kind: 'protein_foods', label: 'Show high-protein foods' },
      });
    }
  }

  const goalDeltaKg = profile.targetWeightKg != null ? profile.targetWeightKg - profile.weightKg : 0;
  const wantsChange = Math.abs(goalDeltaKg) >= 0.5;
  const stallTrend = weeklyWeightTrend(weights, from, today, MIN_STALL_SPAN_DAYS);
  if (wantsChange && stallTrend && Math.abs(stallTrend.kgPerWeek) < STALL_KG_PER_WEEK) {
    const direction = goalDeltaKg < 0 ? 'lose' : 'gain';
    const fix = goalDeltaKg < 0 ? 'eating slightly less than you think' : 'eating slightly more than you think';
    insights.push({
      id: 'weight_stalled',
      key: 'weight_stalled',
      tone: 'suggestion',
      title: 'Your weight has been flat',
      detail: `Barely any movement across ${plural(stallTrend.spanDays, 'day')} and ${plural(stallTrend.count, 'weigh-in')}, while your goal is to ${direction}. Usually that means ${fix}, or that the target needs revisiting — both are worth a look before changing anything drastic.`,
      priority: 2,
    });
  }

  const lifts = liftHistories(workoutLogs, from, today);

  // Report only the worst stall: a list of every plateaued lift is a wall, not advice.
  let worstStall: { id: string; name: string; sessions: number; weightKg: number } | null = null;
  for (const lift of lifts) {
    const topWeight = lift.sessions[lift.sessions.length - 1].topWeightKg;
    let atWeight = 0;
    for (let i = lift.sessions.length - 1; i >= 0; i--) {
      if (lift.sessions[i].topWeightKg !== topWeight) break;
      atWeight += 1;
    }
    if (atWeight >= MIN_STALLED_SESSIONS && (!worstStall || atWeight > worstStall.sessions)) {
      worstStall = { id: lift.id, name: lift.name, sessions: atWeight, weightKg: topWeight };
    }
  }
  if (worstStall) {
    // The exercise library knows the equipment, which decides what "10% lighter" can actually be
    // loaded as. An exercise it doesn't know falls back to barbell steps, the coarsest common one.
    const equipment = findExercise(worstStall.id)?.equipment ?? 'Barbell';
    const deloadKg = deloadWeight(worstStall.weightKg, equipment);
    const remedy =
      deloadKg !== null
        ? `Dropping to ${load(deloadKg, unit)} for a session and building back up`
        : 'Changing the rep range or swapping in a variation';
    insights.push({
      id: 'lift_stalled',
      key: `lift_stalled:${worstStall.id}:${worstStall.weightKg}`,
      tone: 'suggestion',
      title: `${worstStall.name} has stopped moving`,
      detail: `Same top weight of ${load(worstStall.weightKg, unit)} for ${plural(worstStall.sessions, 'session')}. ${remedy} usually breaks a plateau faster than grinding at the same load.`,
      priority: 3,
      action:
        deloadKg !== null
          ? {
              kind: 'deload',
              label: `Deload to ${load(deloadKg, unit)}`,
              exerciseId: worstStall.id,
              stalledKg: worstStall.weightKg,
              deloadKg,
            }
          : undefined,
    });
  }

  const nights = sleep.filter((s) => s.date >= from && s.date <= today && s.hours > 0);
  if (nights.length >= MIN_SLEEP_NIGHTS) {
    const mean = nights.reduce((s, n) => s + n.hours, 0) / nights.length;
    if (mean < SLEEP_GOAL_HOURS - 1.5) {
      insights.push({
        id: 'sleep_short',
        key: 'sleep_short',
        tone: 'suggestion',
        title: 'Short sleep is working against your training',
        detail: `Averaging ${mean.toFixed(1)} hours across ${plural(nights.length, 'night')}. Recovery is when training turns into progress, and under-sleeping blunts both strength gains and appetite control.`,
        priority: 4,
      });
    }
  }

  // --- Cardio, for the goals that are about it. ---
  // Only once the user has two weeks of history of any kind: a new account has logged no cardio
  // because it's new, not because they don't do any.
  const cardioGoal = profile.goal === 'improve_endurance' || profile.goal === 'general_health';
  const windowStart = addDaysISO(today, -(CARDIO_WINDOW_DAYS - 1));
  const earliest = [...workoutLogs.map((w) => w.date), ...foodEntries.map((f) => f.date), ...weights.map((w) => w.date)]
    .reduce<string | null>((min, d) => (min === null || d < min ? d : min), null);
  if (cardioGoal && earliest !== null && earliest <= windowStart) {
    const perWeek = Math.round(cardioMinutes(workoutLogs, windowStart, today) / (CARDIO_WINDOW_DAYS / 7));
    if (perWeek < CARDIO_BASELINE_MIN_PER_WEEK) {
      const why =
        profile.goal === 'improve_endurance'
          ? 'Endurance is built almost entirely out of that base — more steady minutes, before anything harder.'
          : "It's the single habit most tied to long-term health, and it doesn't need to be intense to count.";
      insights.push({
        id: 'cardio_low',
        key: 'cardio_low',
        tone: 'suggestion',
        title: perWeek === 0 ? 'No cardio logged in two weeks' : 'Cardio is under the weekly baseline',
        detail: `${perWeek === 0 ? 'Nothing' : `About ${perWeek} minutes a week`} over the last two weeks, against the WHO baseline of ${CARDIO_BASELINE_MIN_PER_WEEK}. ${why}`,
        priority: 4,
        action: { kind: 'log_cardio', label: 'Log cardio' },
      });
    }
  }

  // --- A finished block. ---
  // Only when the weeks were actually trained: someone who applied a plan ten weeks ago and
  // logged four sessions hasn't finished anything, and telling them they have would be flattery
  // the data doesn't support.
  const template = profile.activePlan ? PLAN_TEMPLATES.find((t) => t.id === profile.activePlan!.templateId) : undefined;
  if (profile.activePlan && template) {
    const block = planBlock(template, profile.activePlan.startedOn, today);
    const sessions = workoutLogs.filter((w) => w.date >= profile.activePlan!.startedOn && w.date <= today).length;
    if (block.complete && sessions >= template.weeks * template.daysPerWeek * MIN_BLOCK_ADHERENCE) {
      insights.push({
        id: 'plan_complete',
        key: `plan_complete:${template.id}:${profile.activePlan.startedOn}`,
        tone: 'suggestion',
        title: `You've finished ${template.weeks} weeks of ${template.name}`,
        detail: `${plural(sessions, 'session')} since you started it. Programs like this are built to run about ${template.weeks} weeks — after that, switching the split, or restarting it from week 1 with heavier starting weights, keeps training from going stale.`,
        priority: 5,
        action: { kind: 'browse_plans', label: 'Choose what’s next' },
      });
    }
  }

  // --- Wins. Only ever one, and never ahead of something actionable. ---
  const wins: Insight[] = [];

  let bestGain: { name: string; gainKg: number; sessions: number } | null = null;
  for (const lift of lifts) {
    if (lift.sessions.length < 2) continue;
    // Never congratulate the lift we just called stalled. A press that climbed for a month and
    // then flattened is honestly described by both, but shown side by side they read as the app
    // contradicting itself — and the plateau is the half worth acting on.
    if (worstStall && lift.id === worstStall.id) continue;
    const gain = lift.sessions[lift.sessions.length - 1].topWeightKg - lift.sessions[0].topWeightKg;
    if (gain > 0 && (!bestGain || gain > bestGain.gainKg)) {
      bestGain = { name: lift.name, gainKg: gain, sessions: lift.sessions.length };
    }
  }
  if (bestGain) {
    wins.push({
      id: 'lift_progressing',
      key: `lift_progressing:${bestGain.name}`,
      tone: 'win',
      title: `${bestGain.name} is up ${load(bestGain.gainKg, unit)}`,
      detail: `Across ${plural(bestGain.sessions, 'session')} in the last four weeks. That's progressive overload doing exactly what it should.`,
      priority: 10,
    });
  }

  const activeDays = new Set<string>();
  for (const f of foodEntries) if (f.date >= from && f.date <= today) activeDays.add(f.date);
  for (const w of workoutLogs) if (w.date >= from && w.date <= today) activeDays.add(w.date);
  const possibleDays = daysBetween(from, today) + 1;
  if (possibleDays > 0 && activeDays.size / possibleDays >= STRONG_ADHERENCE) {
    wins.push({
      id: 'strong_consistency',
      key: 'strong_consistency',
      tone: 'win',
      title: `${activeDays.size} of the last ${possibleDays} days logged`,
      detail: 'Consistency is the whole game, and this is what it looks like. It also makes every number FitTrack shows you more accurate.',
      priority: 11,
    });
  }

  if (wins.length > 0) {
    wins.sort((a, b) => a.priority - b.priority);
    insights.push(wins[0]);
  }

  return insights.sort((a, b) => a.priority - b.priority);
}

/** How long "not now" hides an insight. Long enough to stop nagging, short enough to come back. */
export const INSIGHT_SNOOZE_DAYS = 7;

/**
 * Drop insights the user has said "not now" to, until the snooze runs out.
 *
 * A card that repeats the same advice every time the app opens stops being read within a week —
 * and then it isn't read on the day it says something new. Snoozing is keyed on the specific
 * observation (see Insight.key), so a *different* plateau, or the same lift stalling again at a
 * new weight, still gets through.
 */
export function withoutSnoozed(insights: Insight[], snoozedUntil: Record<string, string>, today: string): Insight[] {
  return insights.filter((i) => {
    const until = snoozedUntil[i.key];
    return !until || until <= today;
  });
}
