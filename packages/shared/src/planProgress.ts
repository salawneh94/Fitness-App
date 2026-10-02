import type { ScheduledWorkout, Weekday, WorkoutLogEntry, WorkoutPlanTemplate } from './types';
import { addDaysISO } from './calc';

const WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The plan the user is following, and since when. Stored on the profile so it syncs. */
export interface ActivePlan {
  templateId: string;
  startedOn: string; // YYYY-MM-DD
}

/** Monday of the week containing a calendar date. Calendar arithmetic only — no local clock. */
export function mondayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDaysISO(iso, -((dow + 6) % 7));
}

/**
 * Which week of the plan this is, counting calendar weeks (Monday to Sunday) from the start.
 *
 * Calendar weeks rather than seven-day blocks from the start date, because the schedule is laid
 * out on weekdays: a plan started on a Thursday is in its second week on the following Monday,
 * the day its schedule starts over. Never below 1, so a start date set on another device with a
 * clock running ahead can't produce "week 0".
 */
export function planWeekNumber(startedOn: string, today: string): number {
  const [a, b] = [mondayOf(startedOn), mondayOf(today)].map((iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.max(1, Math.round((b - a) / (7 * 86_400_000)) + 1);
}

export type DayStatus = 'done' | 'made_up' | 'missed' | 'today' | 'upcoming' | 'rest';

export interface WeekDay {
  day: Weekday;
  date: string;
  /** What's scheduled, if anything. */
  workoutName?: string;
  status: DayStatus;
  /** For a made-up session: the date it was actually done. */
  madeUpOn?: string;
  /** A session was logged on this day beyond what was scheduled for it. Counted, never penalised. */
  extra: boolean;
}

export interface WeekOverview {
  days: WeekDay[];
  /** Sessions scheduled this week, and how many of them happened (on the day, or made up later). */
  planned: number;
  done: number;
  /** Sessions logged that weren't any scheduled session. */
  extras: number;
  /** The next scheduled session not yet done — today's, if it's still to do. */
  next: { day: Weekday; date: string; workoutName: string } | null;
  /** Missed this week and not made up yet, oldest first. */
  missed: { day: Weekday; date: string; workoutName: string }[];
}

/**
 * This calendar week of the schedule, day by day, against what was actually logged.
 *
 * A scheduled day counts as done if any session was logged on it. Matching the session to the
 * scheduled workout by name would be stricter and worse: someone who swaps Thursday's legs for an
 * upper session because their knee hurts *trained*, and calling that a miss would be both wrong
 * and the fastest way to make them stop logging honestly.
 *
 * A missed day is made up by a later session this week with its name — which is what logging it
 * from "Make it up today" produces. Each logged session counts once: it completes its own day,
 * or makes up one missed day, or is an extra.
 */
export function weekOverview(schedule: ScheduledWorkout[], logs: WorkoutLogEntry[], today: string): WeekOverview {
  const monday = mondayOf(today);
  const sunday = addDaysISO(monday, 6);
  const byDay = new Map(schedule.map((w) => [w.day, w]));

  // This week's sessions, oldest first; each is consumed at most once below.
  const pool = logs
    .filter((l) => l.date >= monday && l.date <= sunday)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) => ({ date: l.date, name: l.workoutName, used: false }));

  const days: WeekDay[] = WEEKDAYS.map((day, i) => {
    const date = addDaysISO(monday, i);
    const scheduled = byDay.get(day);
    return { day, date, workoutName: scheduled?.name, status: scheduled ? 'upcoming' : 'rest', extra: false };
  });

  // 1. Every scheduled day claims a session from its own date — its own workout if it was logged
  //    that day, otherwise whatever was.
  for (const d of days) {
    if (!d.workoutName) continue;
    const own = pool.find((l) => !l.used && l.date === d.date && l.name === d.workoutName)
      ?? pool.find((l) => !l.used && l.date === d.date);
    if (own) {
      own.used = true;
      d.status = 'done';
    }
  }

  // 2. Past scheduled days with nothing logged: made up later this week, or missed.
  for (const d of days) {
    if (!d.workoutName || d.status === 'done') continue;
    if (d.date < today) {
      const makeUp = pool.find((l) => !l.used && l.date > d.date && l.name === d.workoutName);
      if (makeUp) {
        makeUp.used = true;
        d.status = 'made_up';
        d.madeUpOn = makeUp.date;
      } else {
        d.status = 'missed';
      }
    } else if (d.date === today) {
      d.status = 'today';
    }
  }

  // 3. Whatever's left is extra — shown on the day it happened.
  for (const l of pool) {
    if (l.used) continue;
    const d = days.find((x) => x.date === l.date)!;
    d.extra = true;
    if (!d.workoutName) d.status = 'done';
  }

  const scheduledDays = days.filter((d) => d.workoutName !== undefined);
  let next: WeekOverview['next'] = null;
  const pending = scheduledDays.find((d) => d.status === 'today' || d.status === 'upcoming');
  if (pending) {
    next = { day: pending.day, date: pending.date, workoutName: pending.workoutName! };
  } else if (schedule.length > 0) {
    // Nothing left this week: the first session of next week.
    const first = WEEKDAYS.find((d) => byDay.has(d))!;
    next = { day: first, date: addDaysISO(monday, 7 + WEEKDAYS.indexOf(first)), workoutName: byDay.get(first)!.name };
  }

  return {
    days,
    planned: scheduledDays.length,
    done: scheduledDays.filter((d) => d.status === 'done' || d.status === 'made_up').length,
    extras: pool.filter((l) => !l.used).length,
    next,
    missed: scheduledDays
      .filter((d) => d.status === 'missed')
      .map((d) => ({ day: d.day, date: d.date, workoutName: d.workoutName! })),
  };
}

/**
 * Can a missed session be made up today without doubling up? Only on a free day: nothing
 * scheduled, nothing trained yet. A day whose own session is still to do — or already done —
 * would end up with two, and piling sessions into one day is how people get hurt.
 */
export function canMakeUpToday(week: WeekOverview, today: string): boolean {
  const d = week.days.find((x) => x.date === today);
  return !!d && d.workoutName === undefined && !d.extra;
}

/** Block progress: "week 3 of 10", and whether the block is over. */
export function planBlock(template: WorkoutPlanTemplate, startedOn: string, today: string): { week: number; of: number; complete: boolean } {
  const week = planWeekNumber(startedOn, today);
  return { week, of: template.weeks, complete: week > template.weeks };
}

/**
 * Has the schedule been edited away from the template it came from?
 *
 * Users rename sessions and move days in the Workouts tab, and the plan view should say "based
 * on" rather than claim the schedule *is* the template. Compared on session names, the part a
 * user sees — the weekday layout is the app's choice, not theirs, so moving a day isn't checked.
 */
export function isCustomised(template: WorkoutPlanTemplate, schedule: ScheduledWorkout[]): boolean {
  const expected = template.days.slice(0, 7).map((d) => d.focus).sort();
  const actual = schedule.map((w) => w.name).sort();
  return expected.length !== actual.length || expected.some((name, i) => name !== actual[i]);
}
