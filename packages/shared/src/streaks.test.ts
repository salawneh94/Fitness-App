import { describe, expect, it, vi, afterEach } from 'vitest';
import { computeStreaks } from './streaks';
import { addDaysISO } from './calc';
import type { FoodEntry, WorkoutLogEntry } from './types';

const TODAY = '2026-09-11';

// computeStreaks reads todayISO() internally, which builds a local-time date. Pin the clock so
// the tests don't drift with the calendar or the runner's timezone.
function freezeToday() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 11, 12, 0, 0));
}
afterEach(() => vi.useRealTimers());

function food(date: string): FoodEntry {
  return {
    id: `f-${date}`,
    date,
    meal: 'lunch',
    name: 'Meal',
    quantity: 1,
    calories: 500,
    proteinG: 30,
    carbsG: 50,
    fatG: 15,
    source: 'manual',
    loggedAt: `${date}T12:00:00.000Z`,
  };
}

function workout(date: string): WorkoutLogEntry {
  return { id: `w-${date}`, date, workoutName: 'Session', durationMin: 45 };
}

/** Days back from TODAY, as dates. */
const back = (...offsets: number[]) => offsets.map((o) => addDaysISO(TODAY, -o));

describe('computeStreaks', () => {
  it('counts consecutive active days ending today', () => {
    freezeToday();
    const days = back(0, 1, 2, 3);
    expect(computeStreaks(days.map(food), [], addDaysISO(TODAY, -30)).currentStreak).toBe(4);
  });

  it('keeps the streak alive on a day that has not been logged yet', () => {
    freezeToday();
    // Nothing today, but yesterday and before — the day isn't over, so don't punish them.
    const days = back(1, 2, 3);
    expect(computeStreaks(days.map(food), [], addDaysISO(TODAY, -30)).currentStreak).toBe(3);
  });

  it('counts a workout as an active day, not just food', () => {
    freezeToday();
    const s = computeStreaks([food(addDaysISO(TODAY, -1))], [workout(TODAY)], addDaysISO(TODAY, -30));
    expect(s.currentStreak).toBe(2);
  });

  it('breaks the streak on a gap', () => {
    freezeToday();
    const days = back(0, 1, 3, 4, 5);
    expect(computeStreaks(days.map(food), [], addDaysISO(TODAY, -30)).currentStreak).toBe(2);
  });

  it('finds the best run even when it is not the current one', () => {
    freezeToday();
    const days = back(0, 1, 5, 6, 7, 8, 9);
    const s = computeStreaks(days.map(food), [], addDaysISO(TODAY, -30));
    expect(s.currentStreak).toBe(2);
    expect(s.bestStreak).toBe(5);
  });

  describe('history older than the profile', () => {
    // Reinstall, sign in, finish onboarding (profile dated today), then pullRemote restores a
    // year of entries behind it. Anything bounded by the profile date is then computed over a
    // window of one day.
    it('never reports a best streak below the current streak', () => {
      freezeToday();
      const days = back(0, 1, 2, 3, 4);
      const s = computeStreaks(days.map(food), [], TODAY); // profile created today
      expect(s.bestStreak).toBeGreaterThanOrEqual(s.currentStreak);
      expect(s.bestStreak).toBe(5);
    });

    it('measures adherence over the real history, not a one-day window', () => {
      freezeToday();
      // 30 consecutive logged days, profile created today.
      const days = Array.from({ length: 30 }, (_, i) => food(addDaysISO(TODAY, -i)));
      const s = computeStreaks(days, [], TODAY);
      expect(s.adherence7d).toBe(1);
      expect(s.adherence30d).toBe(1);
    });

    it('still reports a partial month honestly', () => {
      freezeToday();
      // Logged every other day, oldest entry 28 days back. The window runs from the start of
      // history to today — 29 days — rather than a flat 30: nobody should be marked down for
      // days before they had any data at all.
      const days = Array.from({ length: 15 }, (_, i) => food(addDaysISO(TODAY, -i * 2)));
      const s = computeStreaks(days, [], TODAY);
      expect(s.adherence30d).toBeCloseTo(15 / 29, 5);
    });
  });

  it('does not count days before the profile when there is no earlier history', () => {
    freezeToday();
    // Profile made 3 days ago, logged every day since — adherence is over those 4 days only,
    // not diluted by the 26 days before they existed.
    const since = addDaysISO(TODAY, -3);
    const s = computeStreaks(back(0, 1, 2, 3).map(food), [], since);
    expect(s.adherence30d).toBe(1);
  });

  it('handles a user with no activity at all', () => {
    freezeToday();
    const s = computeStreaks([], [], TODAY);
    expect(s).toMatchObject({ currentStreak: 0, bestStreak: 0, activeDaysTotal: 0 });
    expect(s.adherence7d).toBe(0);
  });

  it('counts a day once even when it holds several entries', () => {
    freezeToday();
    const s = computeStreaks([food(TODAY), food(TODAY)], [workout(TODAY)], TODAY);
    expect(s.activeDaysTotal).toBe(1);
    expect(s.currentStreak).toBe(1);
  });
});
