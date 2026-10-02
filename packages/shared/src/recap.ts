import type { FoodEntry, Profile, ScheduledWorkout, WorkoutLogEntry } from './types';
import type { PersonalRecord } from './records';
import { recordsForLog } from './records';
import { addDaysISO } from './calc';
import { weekOverview } from './planProgress';
import { formatDistance } from './cardio';
import { displayWeight, weightUnitLabel } from './units';

/** Below this a day's food log is a partial entry — the same line the insights draw. */
const MIN_CREDIBLE_DAILY_KCAL = 1000;
const PROTEIN_HIT_FRACTION = 0.85;
/** A weekly-average change smaller than this is noise, reported as steady. */
const WEIGHT_STEADY_KG = 0.1;

export interface RecapInput {
  profile: Profile;
  schedule: ScheduledWorkout[];
  workoutLogs: WorkoutLogEntry[];
  foodEntries: FoodEntry[];
  weights: { date: string; weightKg: number }[];
  targets: { calories: number; proteinG: number };
  /** Monday of the week to summarise. */
  weekStart: string;
}

export interface WeeklyRecap {
  weekStart: string;
  weekEnd: string;
  /** Nothing logged at all — no food, no training, no weigh-in. */
  empty: boolean;
  sessions: { done: number; planned: number; extras: number };
  sets: number;
  records: PersonalRecord[];
  cardio: { distanceKm: number; minutes: number; sessions: number; previousDistanceKm: number };
  nutrition: { daysLogged: number; avgCalories: number | null; proteinDaysHit: number; fullDays: number };
  weightChangeKg: number | null;
  /** The one thing worth leading with. */
  headline: string;
  /** Short sentences, most important first. */
  lines: string[];
  /** One line for a notification. */
  summary: string;
}

const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

function cardioTotals(logs: WorkoutLogEntry[], from: string, to: string) {
  let distanceKm = 0;
  let minutes = 0;
  let sessions = 0;
  for (const l of logs) {
    if (l.date < from || l.date > to || !l.cardio?.length) continue;
    sessions += 1;
    for (const c of l.cardio) {
      distanceKm += c.distanceKm ?? 0;
      minutes += c.durationMin;
    }
  }
  return { distanceKm, minutes, sessions };
}

function averageWeight(weights: { date: string; weightKg: number }[], from: string, to: string): number | null {
  const inWeek = weights.filter((w) => w.date >= from && w.date <= to && w.weightKg > 0);
  // One reading is a snapshot of that morning's water, not a week.
  if (inWeek.length < 2) return null;
  return inWeek.reduce((s, w) => s + w.weightKg, 0) / inWeek.length;
}

/**
 * A week, told back as a few sentences rather than a dashboard.
 *
 * Everything in it was already on some tab; the point is that nobody reviews five tabs on a Sunday,
 * and a week that went well is worth hearing about as much as one that didn't. It leads with the
 * best thing that happened, says what happened plainly, and compares only like with like — this
 * week's cardio against last week's, weekly-average weight against last week's average.
 */
export function weeklyRecap(input: RecapInput): WeeklyRecap {
  const { profile, schedule, workoutLogs, foodEntries, weights, targets, weekStart } = input;
  const unit = profile.unitSystem;
  const weekEnd = addDaysISO(weekStart, 6);
  const prevStart = addDaysISO(weekStart, -7);
  const prevEnd = addDaysISO(weekStart, -1);
  const inWeek = (d: string) => d >= weekStart && d <= weekEnd;

  // Training against the plan. Judged as of the week's last day, so "today" on Sunday — still to
  // do in the live view — counts as not done here, which is what it is once the week is over.
  const overview = weekOverview(schedule, workoutLogs, weekEnd);
  const sessions = { done: overview.done, planned: overview.planned, extras: overview.extras };
  const weekLogs = workoutLogs.filter((l) => inWeek(l.date));
  const sets = weekLogs.reduce((s, l) => s + (l.exerciseLogs ?? []).reduce((t, e) => t + e.sets.length, 0), 0);
  const records = weekLogs.flatMap((l) => recordsForLog(l, workoutLogs, unit));

  const thisCardio = cardioTotals(workoutLogs, weekStart, weekEnd);
  const prevCardio = cardioTotals(workoutLogs, prevStart, prevEnd);
  const cardio = { ...thisCardio, previousDistanceKm: prevCardio.distanceKm };

  const byDay = new Map<string, { calories: number; proteinG: number }>();
  for (const f of foodEntries) {
    if (!inWeek(f.date)) continue;
    const d = byDay.get(f.date) ?? { calories: 0, proteinG: 0 };
    d.calories += f.calories * f.quantity;
    d.proteinG += f.proteinG * f.quantity;
    byDay.set(f.date, d);
  }
  const full = [...byDay.values()].filter((d) => d.calories >= MIN_CREDIBLE_DAILY_KCAL);
  const nutrition = {
    daysLogged: byDay.size,
    fullDays: full.length,
    avgCalories: full.length > 0 ? Math.round(full.reduce((s, d) => s + d.calories, 0) / full.length) : null,
    proteinDaysHit: full.filter((d) => d.proteinG >= targets.proteinG * PROTEIN_HIT_FRACTION).length,
  };

  const thisAvg = averageWeight(weights, weekStart, weekEnd);
  const prevAvg = averageWeight(weights, prevStart, prevEnd);
  const weightChangeKg = thisAvg !== null && prevAvg !== null ? thisAvg - prevAvg : null;

  const empty = weekLogs.length === 0 && byDay.size === 0 && !weights.some((w) => inWeek(w.date));

  // --- the sentences ------------------------------------------------------------------------
  const lines: string[] = [];
  if (sessions.planned > 0) {
    lines.push(
      `${sessions.done} of ${plural(sessions.planned, 'planned session')} done${sessions.extras > 0 ? `, plus ${sessions.extras} extra` : ''}.`
    );
  } else if (weekLogs.length > 0) {
    lines.push(`${plural(weekLogs.length, 'workout')} logged.`);
  }
  if (records.length > 0) {
    const names = [...new Set(records.map((r) => r.exerciseName))];
    lines.push(`New ${records.length === 1 ? 'personal best' : 'personal bests'}: ${names.join(', ')}.`);
  }
  if (cardio.sessions > 0) {
    const what = cardio.distanceKm > 0 ? formatDistance(cardio.distanceKm, unit) : `${cardio.minutes} min`;
    let vs = '';
    if (cardio.distanceKm > 0 && cardio.previousDistanceKm > 0) {
      const delta = cardio.distanceKm - cardio.previousDistanceKm;
      vs = Math.abs(delta) < 0.05 ? ', same as the week before' : `, ${delta > 0 ? 'up' : 'down'} ${formatDistance(Math.abs(delta), unit)} on the week before`;
    }
    lines.push(`${what} of cardio over ${plural(cardio.sessions, 'session')}${vs}.`);
  }
  if (nutrition.daysLogged > 0) {
    let food = `Food logged on ${nutrition.daysLogged} of 7 days`;
    if (nutrition.avgCalories !== null) food += `, averaging ${nutrition.avgCalories} kcal against a ${targets.calories} target`;
    lines.push(`${food}.`);
    if (nutrition.fullDays > 0) lines.push(`Protein target hit on ${nutrition.proteinDaysHit} of ${plural(nutrition.fullDays, 'full day')}.`);
  }
  if (weightChangeKg !== null) {
    const amount = `${Math.round(displayWeight(Math.abs(weightChangeKg), unit) * 10) / 10} ${weightUnitLabel(unit)}`;
    lines.push(
      Math.abs(weightChangeKg) < WEIGHT_STEADY_KG
        ? 'Weight steady on the week before (weekly average).'
        : `Weight ${weightChangeKg < 0 ? 'down' : 'up'} ${amount} on the week before (weekly average).`
    );
  }

  // --- the headline: the best thing, not the first ------------------------------------------
  let headline: string;
  if (empty) headline = 'A quiet week';
  else if (records.length > 1) headline = `${records.length} new personal bests`;
  else if (records.length === 1) headline = `A new personal best on ${records[0].exerciseName}`;
  else if (sessions.planned > 0 && sessions.done >= sessions.planned) headline = 'Every planned session done';
  else if (cardio.distanceKm > 0 && cardio.previousDistanceKm > 0 && cardio.distanceKm > cardio.previousDistanceKm * 1.1)
    headline = 'More cardio than the week before';
  else if (nutrition.daysLogged === 7) headline = 'Food logged every day';
  else if (sessions.done > 0 || weekLogs.length > 0) headline = `${plural(Math.max(sessions.done, weekLogs.length), 'session')} in the bag`;
  else headline = 'Your week';

  const bits = [
    sessions.planned > 0 ? `${sessions.done}/${sessions.planned} sessions` : weekLogs.length > 0 ? plural(weekLogs.length, 'workout') : null,
    cardio.distanceKm > 0 ? `${formatDistance(cardio.distanceKm, unit)} cardio` : null,
    records.length > 0 ? (records.length === 1 ? '1 new PB' : `${records.length} new PBs`) : null,
    nutrition.daysLogged > 0 ? `food logged ${nutrition.daysLogged}/7 days` : null,
  ].filter(Boolean);
  // An empty week gets a nudge forward rather than a tally of zeros: nobody reopens an app to be
  // told they did nothing.
  const summary = empty ? 'A new week starts tomorrow — your plan is ready when you are.' : `${headline}. ${bits.join(' · ')}`;

  // Nothing logged means nothing to report — "0 of 3 sessions done" is exactly the tally of zeros
  // the summary avoids, and it would be the only line.
  return { weekStart, weekEnd, empty, sessions, sets, records, cardio, nutrition, weightChangeKg, headline, lines: empty ? [] : lines, summary };
}

/**
 * When the next weekly recap goes out: this Sunday at `hour` local time, or next Sunday's if that
 * has passed. Local time throughout — "Sunday evening" means the user's evening.
 */
export function nextRecapAt(now: Date, hour: number): Date {
  const at = new Date(now);
  at.setDate(now.getDate() + ((7 - now.getDay()) % 7)); // getDay: 0 is Sunday
  at.setHours(hour, 0, 0, 0);
  if (at <= now) at.setDate(at.getDate() + 7);
  return at;
}
