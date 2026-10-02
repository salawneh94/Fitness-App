import { describe, expect, it } from 'vitest';
import { nextRecapAt, weeklyRecap, type RecapInput } from './recap';
import type { FoodEntry, Profile, ScheduledWorkout, WorkoutLogEntry } from './types';

// Week under review: Mon 2026-09-21 .. Sun 2026-09-27. The week before: 09-14 .. 09-20.
const WEEK = '2026-09-21';
const profile: Profile = {
  name: 'S', age: 31, sex: 'male', heightCm: 180, weightKg: 84, goal: 'build_muscle', timeframeWeeks: 12, expectations: '',
  activityLevel: 'moderate', preferredDaysPerWeek: 3, unitSystem: 'metric', createdAt: '2026-08-01T00:00:00Z',
};
const schedule: ScheduledWorkout[] = (['Mon', 'Wed', 'Fri'] as const).map((day) => ({ id: day, day, name: `${day} lift`, exercises: [] }));
const lift = (date: string, kg: number, name = 'Lift'): WorkoutLogEntry => ({
  id: `${date}-${name}`, date, workoutName: name, durationMin: 50,
  exerciseLogs: [{ exerciseId: 'bench-press', exerciseName: 'Bench Press', sets: [{ weightKg: kg, reps: 5 }, { weightKg: kg, reps: 5 }] }],
});
const run = (date: string, km: number): WorkoutLogEntry => ({
  id: `${date}-run`, date, workoutName: 'Run', durationMin: 30, cardio: [{ activity: 'run', durationMin: 30, distanceKm: km }],
});
const food = (date: string, calories: number, proteinG: number): FoodEntry => ({
  id: `${date}-${calories}`, date, meal: 'lunch', name: 'Meal', quantity: 1, calories, proteinG, carbsG: 0, fatG: 0, source: 'manual', loggedAt: `${date}T12:00:00Z`,
});

const base: RecapInput = { profile, schedule, workoutLogs: [], foodEntries: [], weights: [], targets: { calories: 2600, proteinG: 150 }, weekStart: WEEK };
const recap = (over: Partial<RecapInput>) => weeklyRecap({ ...base, ...over });

describe('weeklyRecap', () => {
  const goodWeek = {
    workoutLogs: [
      lift('2026-09-14', 80), // the week before: a baseline for the record
      run('2026-09-16', 5),
      lift('2026-09-21', 85), lift('2026-09-23', 85), lift('2026-09-25', 85),
      run('2026-09-24', 6), run('2026-09-26', 4),
    ],
    foodEntries: ['21', '22', '23', '24', '25'].map((d) => food(`2026-09-${d}`, 2500, d === '25' ? 100 : 160)),
    weights: [
      { date: '2026-09-15', weightKg: 84.6 }, { date: '2026-09-18', weightKg: 84.4 },
      { date: '2026-09-22', weightKg: 84.1 }, { date: '2026-09-26', weightKg: 83.9 },
    ],
  };

  it('tells a good week as a few plain sentences, best news first', () => {
    const r = recap(goodWeek);
    // Two records: the 85 kg bench beats 80, and Wednesday's 6 km beats the 5 km run before it.
    expect(r.headline).toBe('2 new personal bests');
    expect(r.lines).toEqual([
      '3 of 3 planned sessions done, plus 2 extra.',
      'New personal bests: Bench Press, Run.',
      '10 km of cardio over 2 sessions, up 5 km on the week before.',
      'Food logged on 5 of 7 days, averaging 2500 kcal against a 2600 target.',
      'Protein target hit on 4 of 5 full days.',
      'Weight down 0.5 kg on the week before (weekly average).',
    ]);
    expect(r.summary).toBe('2 new personal bests. 3/3 sessions · 10 km cardio · 2 new PBs · food logged 5/7 days');
  });

  it('a weight is a record once, even across three sessions at it', () => {
    // 85 first beats 80 on Monday; Wednesday's and Friday's 85s only match it.
    expect(recap(goodWeek).records.filter((r) => r.exerciseName === 'Bench Press')).toHaveLength(1);
  });

  it('a single record leads by name', () => {
    expect(recap({ workoutLogs: [lift('2026-09-14', 80), lift('2026-09-21', 85)] }).headline).toBe('A new personal best on Bench Press');
  });

  it('judges Sunday as over: a scheduled Sunday with nothing logged is not done', () => {
    const sunday = [{ id: 'Sun', day: 'Sun' as const, name: 'Sun lift', exercises: [] }];
    expect(recap({ schedule: sunday, workoutLogs: [] }).sessions).toEqual({ done: 0, planned: 1, extras: 0 });
  });

  it('leaves out partial food days from the average, and needs two weigh-ins a week for a weight line', () => {
    const r = recap({
      foodEntries: [food('2026-09-21', 2400, 150), food('2026-09-22', 300, 10)],
      weights: [{ date: '2026-09-15', weightKg: 84 }, { date: '2026-09-17', weightKg: 84 }, { date: '2026-09-22', weightKg: 83 }],
    });
    expect(r.nutrition).toEqual({ daysLogged: 2, fullDays: 1, avgCalories: 2400, proteinDaysHit: 1 });
    expect(r.weightChangeKg).toBeNull();
    expect(r.lines.some((l) => l.startsWith('Weight'))).toBe(false);
  });

  it('every planned session done leads when there is no record', () => {
    const r = recap({ workoutLogs: ['21', '23', '25'].map((d) => ({ id: d, date: `2026-09-${d}`, workoutName: 'x', durationMin: 40 })) });
    expect(r.headline).toBe('Every planned session done');
  });

  it('an empty week is a nudge forward, not a tally of zeros', () => {
    const r = recap({});
    expect(r.empty).toBe(true);
    expect(r.lines).toEqual([]);
    expect(r.summary).toBe('A new week starts tomorrow — your plan is ready when you are.');
  });

  it('speaks the user’s units', () => {
    const r = recap({ ...goodWeek, profile: { ...profile, unitSystem: 'imperial' } });
    expect(r.lines).toContain('6.2 mi of cardio over 2 sessions, up 3.1 mi on the week before.');
    expect(r.lines).toContain('Weight down 1.1 lb on the week before (weekly average).');
  });
});

describe('nextRecapAt', () => {
  // Built from local parts, so these hold in any timezone the suite runs under.
  const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
  const parts = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()];

  it('is this Sunday at 6pm from any earlier day of the week', () => {
    expect(parts(nextRecapAt(local(2026, 10, 2, 9), 18))).toEqual([2026, 10, 4, 18, 0]); // Friday
    expect(parts(nextRecapAt(local(2026, 9, 28, 0, 1), 18))).toEqual([2026, 10, 4, 18, 0]); // Monday
  });

  it('is today on a Sunday before 6pm, and next Sunday after it', () => {
    expect(parts(nextRecapAt(local(2026, 10, 4, 17, 59), 18))).toEqual([2026, 10, 4, 18, 0]);
    expect(parts(nextRecapAt(local(2026, 10, 4, 18, 0), 18))).toEqual([2026, 10, 11, 18, 0]);
  });

  it('keeps 6pm local across a daylight-saving change', () => {
    // Europe/US clocks change on the last/first Sunday around here; the hour must stay 18.
    expect(parts(nextRecapAt(local(2026, 10, 30, 12), 18))).toEqual([2026, 11, 1, 18, 0]);
    expect(parts(nextRecapAt(local(2026, 3, 26, 12), 18))).toEqual([2026, 3, 29, 18, 0]);
  });
});
