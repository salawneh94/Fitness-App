import type { FoodEntry, Profile, WorkoutLogEntry } from './types';
import { addDaysISO, planDailyTargets, SLEEP_GOAL_HOURS } from './calc';
import { daysBetween, slopePerDay } from './trend';

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

export type InsightTone = 'warning' | 'suggestion' | 'win';

export type InsightId =
  | 'losing_too_fast'
  | 'protein_short'
  | 'weight_stalled'
  | 'lift_stalled'
  | 'sleep_short'
  | 'lift_progressing'
  | 'strong_consistency';

export interface Insight {
  id: InsightId;
  tone: InsightTone;
  title: string;
  /** One sentence naming the evidence, so the claim is checkable rather than mystical. */
  detail: string;
  /** Lower sorts first. Safety outranks goal-blockers, which outrank praise. */
  priority: number;
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
        tone: 'warning',
        title: "You're losing weight faster than is sustainable",
        detail: `Down about ${Math.abs(trend.kgPerWeek).toFixed(2)} kg a week over the last ${plural(trend.spanDays, 'day')} — past roughly ${maxLossPerWeek.toFixed(2)} kg a week you start giving up muscle along with fat. Eating a little more would keep the loss and protect the strength.`,
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
        tone: 'suggestion',
        title: 'Protein is the gap in your nutrition',
        detail: `You hit your ${targets.proteinG}g target on ${hits} of the last ${plural(days.length, 'logged day')}. Protein is the one macro that limits ${goalPhrase}, and it's the easiest of the three to fix.`,
        priority: 1,
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
    insights.push({
      id: 'lift_stalled',
      tone: 'suggestion',
      title: `${worstStall.name} has stopped moving`,
      detail: `Same top weight of ${worstStall.weightKg} kg for ${plural(worstStall.sessions, 'session')}. Dropping about 10% and building back up usually breaks a plateau faster than grinding at the same load.`,
      priority: 3,
    });
  }

  const nights = sleep.filter((s) => s.date >= from && s.date <= today && s.hours > 0);
  if (nights.length >= MIN_SLEEP_NIGHTS) {
    const mean = nights.reduce((s, n) => s + n.hours, 0) / nights.length;
    if (mean < SLEEP_GOAL_HOURS - 1.5) {
      insights.push({
        id: 'sleep_short',
        tone: 'suggestion',
        title: 'Short sleep is working against your training',
        detail: `Averaging ${mean.toFixed(1)} hours across ${plural(nights.length, 'night')}. Recovery is when training turns into progress, and under-sleeping blunts both strength gains and appetite control.`,
        priority: 4,
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
      tone: 'win',
      title: `${bestGain.name} is up ${bestGain.gainKg} kg`,
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
