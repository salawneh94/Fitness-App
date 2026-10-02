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

export type DayStatus = 'done' | 'missed' | 'today' | 'upcoming' | 'rest';

export interface WeekDay {
  day: Weekday;
  date: string;
  /** What's scheduled, if anything. */
  workoutName?: string;
  status: DayStatus;
  /** A session was logged on a day nothing was scheduled. Counted, never penalised. */
  extra: boolean;
}

export interface WeekOverview {
  days: WeekDay[];
  /** Sessions scheduled this week, and how many of those days have a session logged. */
  planned: number;
  done: number;
  /** Sessions logged on unscheduled days. */
  extras: number;
  /** The next scheduled session not yet done — today's, if it's still to do. */
  next: { day: Weekday; date: string; workoutName: string } | null;
}

/**
 * This calendar week of the schedule, day by day, against what was actually logged.
 *
 * A day counts as done if any session was logged on it. Matching the session to the scheduled
 * workout by name would be stricter and worse: someone who swaps Thursday's legs for an upper
 * session because their knee hurts *trained*, and calling that a miss would be both wrong and
 * the fastest way to make them stop logging honestly.
 */
export function weekOverview(schedule: ScheduledWorkout[], logs: WorkoutLogEntry[], today: string): WeekOverview {
  const monday = mondayOf(today);
  const byDay = new Map(schedule.map((w) => [w.day, w]));
  const loggedDates = new Set(logs.map((l) => l.date));

  const days: WeekDay[] = WEEKDAYS.map((day, i) => {
    const date = addDaysISO(monday, i);
    const scheduled = byDay.get(day);
    const logged = loggedDates.has(date);
    let status: DayStatus;
    if (logged) status = 'done';
    else if (!scheduled) status = 'rest';
    else if (date < today) status = 'missed';
    else if (date === today) status = 'today';
    else status = 'upcoming';
    return { day, date, workoutName: scheduled?.name, status, extra: logged && !scheduled };
  });

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
    done: scheduledDays.filter((d) => d.status === 'done').length,
    extras: days.filter((d) => d.extra).length,
    next,
  };
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
