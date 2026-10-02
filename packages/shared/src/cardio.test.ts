import { describe, expect, it } from 'vitest';
import {
  activityForExercise,
  cardioMinutes,
  cardioRecords,
  displayDistance,
  estimateCardioCalories,
  formatDistance,
  formatPace,
  toKmFromDisplay,
  weeklyCardio,
} from './cardio';
import { recordsForLog } from './records';
import { deriveInsights } from './insights';
import { addDaysISO } from './calc';
import type { CardioEntry, Profile, WorkoutLogEntry } from './types';

const run = (distanceKm: number | undefined, durationMin: number): CardioEntry => ({ activity: 'run', durationMin, distanceKm });
const session = (date: string, cardio: CardioEntry[]): WorkoutLogEntry => ({
  id: `${date}-${cardio.map((c) => c.activity).join()}`, date, workoutName: 'Cardio', durationMin: cardio.reduce((s, c) => s + c.durationMin, 0), cardio,
});

describe('units', () => {
  it('converts and formats distance both ways', () => {
    expect(formatDistance(5.25, 'metric')).toBe('5.3 km');
    expect(formatDistance(10, 'metric')).toBe('10 km');
    expect(formatDistance(10, 'imperial')).toBe('6.2 mi');
    expect(toKmFromDisplay(3.1, 'imperial')).toBe(4.989); // to the metre
    expect(displayDistance(toKmFromDisplay(3.1, 'imperial'), 'imperial')).toBeCloseTo(3.1, 3);
  });
});

describe('formatPace', () => {
  it('speaks each sport’s own language', () => {
    expect(formatPace(run(5, 26), 'metric')).toBe('5:12 /km');
    expect(formatPace(run(5, 26), 'imperial')).toBe('8:22 /mi');
    expect(formatPace({ activity: 'cycle', durationMin: 60, distanceKm: 24.5 }, 'metric')).toBe('24.5 km/h');
    expect(formatPace({ activity: 'cycle', durationMin: 60, distanceKm: 24.5 }, 'imperial')).toBe('15.2 mph');
    // Rowers read split per 500 m in every country.
    expect(formatPace({ activity: 'row', durationMin: 8, distanceKm: 2 }, 'imperial')).toBe('2:00 /500m');
    expect(formatPace({ activity: 'swim', durationMin: 20, distanceKm: 1 }, 'metric')).toBe('2:00 /100m');
  });

  it('carries seconds into minutes rather than printing ":60"', () => {
    // 59.7 s/km rounds to 60 → must read 1:00, not 0:60.
    expect(formatPace(run(1, 0.995), 'metric')).toBe('1:00 /km');
  });

  it('has no pace without a distance, or for "other"', () => {
    expect(formatPace(run(undefined, 30), 'metric')).toBeNull();
    expect(formatPace({ activity: 'other', durationMin: 30, distanceKm: 3 }, 'metric')).toBeNull();
  });
});

describe('estimateCardioCalories', () => {
  it('uses distance on foot — about 1 kcal/kg/km running, half that walking', () => {
    expect(estimateCardioCalories(run(5, 30), 70)).toBe(350);
    expect(estimateCardioCalories({ activity: 'walk', durationMin: 60, distanceKm: 5 }, 70)).toBe(175);
  });

  it('falls back to METs × weight × hours', () => {
    expect(estimateCardioCalories(run(undefined, 30), 70)).toBe(343); // 9.8 × 70 × 0.5
    expect(estimateCardioCalories({ activity: 'cycle', durationMin: 45, distanceKm: 18 }, 80)).toBe(408); // 6.8 × 80 × 0.75
  });

  it('refuses to invent a number for "other" or empty input', () => {
    expect(estimateCardioCalories({ activity: 'other', durationMin: 30 }, 70)).toBeNull();
    expect(estimateCardioCalories(run(5, 0), 70)).toBeNull();
  });
});

describe('totals', () => {
  const logs = [session('2026-09-29', [run(5, 30)]), session('2026-10-01', [run(8, 45), { activity: 'walk', durationMin: 20 }]), session('2026-09-22', [run(4, 25)])];

  it('adds up minutes in a range', () => {
    expect(cardioMinutes(logs, '2026-09-28', '2026-10-04')).toBe(95);
  });

  it('groups by calendar week, oldest first, this week last', () => {
    const weeks = weeklyCardio(logs, '2026-10-02', 3);
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-09-14', '2026-09-21', '2026-09-28']);
    expect(weeks[2]).toEqual({ weekStart: '2026-09-28', distanceKm: 13, minutes: 95, sessions: 2 });
    expect(weeks[1]).toMatchObject({ distanceKm: 4, sessions: 1 });
    expect(weeks[0]).toMatchObject({ distanceKm: 0, sessions: 0 });
  });

  it('maps the library’s cardio exercises to activities', () => {
    expect(['running', 'cycling', 'rowing-machine', 'jump-rope'].map(activityForExercise)).toEqual(['run', 'cycle', 'row', 'other']);
  });
});

describe('cardioRecords', () => {
  const history = [session('2026-09-20', [run(5, 28)]), session('2026-09-24', [run(8, 46)])];

  it('a longer distance than ever is the headline', () => {
    const [r] = cardioRecords([run(10, 60)], history, 'metric');
    expect(r).toMatchObject({ kind: 'longest', headline: 'Longest run: 10 km', detail: 'previous best 8 km' });
  });

  it('otherwise a faster pace over a real distance', () => {
    // 5 km in 26 min = 5:12/km, beating 5:36 (28 min / 5 km).
    const [r] = cardioRecords([run(5, 26)], history, 'metric');
    expect(r).toMatchObject({ kind: 'fastest', headline: 'Fastest run: 5:12 /km', detail: 'previous best 5:36 /km' });
  });

  it('ignores a fast sprint too short to count', () => {
    expect(cardioRecords([run(0.4, 1.5)], history, 'metric')).toEqual([]);
  });

  it('the first run, ride or swim is a baseline', () => {
    expect(cardioRecords([{ activity: 'cycle', durationMin: 60, distanceKm: 30 }], history, 'metric')).toEqual([]);
  });

  it('speaks the user’s unit, and shows up in a logged session’s records', () => {
    const later = session('2026-09-28', [run(10, 60)]);
    expect(recordsForLog(later, [...history, later], 'imperial')[0].headline).toBe('Longest run: 6.2 mi');
  });
});

describe('cardio_low insight', () => {
  const TODAY = '2026-10-02';
  const profile: Profile = {
    name: 'T', age: 35, sex: 'female', heightCm: 168, weightKg: 64, goal: 'improve_endurance', timeframeWeeks: 12,
    expectations: '', activityLevel: 'moderate', preferredDaysPerWeek: 4, unitSystem: 'metric', createdAt: '2026-08-01T00:00:00Z',
  };
  const weighIns = [{ date: addDaysISO(TODAY, -20), weightKg: 64 }];
  const insights = (over: Partial<Parameters<typeof deriveInsights>[0]>) =>
    deriveInsights({ profile, foodEntries: [], workoutLogs: [], weights: weighIns, sleep: [], today: TODAY, ...over });
  const find = (list: ReturnType<typeof deriveInsights>) => list.find((i) => i.id === 'cardio_low');

  it('flags a fortnight under 150 minutes a week, with the number and a way to act', () => {
    const logs = [session(addDaysISO(TODAY, -3), [run(5, 30)]), session(addDaysISO(TODAY, -10), [run(5, 30)])];
    const i = find(insights({ workoutLogs: logs }))!;
    expect(i.title).toBe('Cardio is under the weekly baseline');
    expect(i.detail).toContain('About 30 minutes a week');
    expect(i.action).toEqual({ kind: 'log_cardio', label: 'Log cardio' });
  });

  it('is quiet at or above the baseline', () => {
    const logs = [0, 2, 4, 7, 9, 11].map((d) => session(addDaysISO(TODAY, -d), [run(8, 50)]));
    expect(find(insights({ workoutLogs: logs }))).toBeUndefined();
  });

  it('is quiet for a new account and for goals that aren’t about cardio', () => {
    expect(find(insights({ weights: [{ date: addDaysISO(TODAY, -5), weightKg: 64 }] }))).toBeUndefined();
    expect(find(insights({ profile: { ...profile, goal: 'build_muscle' } }))).toBeUndefined();
  });

  it('says so plainly when there was none at all', () => {
    expect(find(insights({}))!.title).toBe('No cardio logged in two weeks');
  });
});
