import { describe, expect, it } from 'vitest';
import { MOVEMENT_PATTERN, deloadWeight, isDeloadActive, lastPerformance, parseRepRange, suggestNextLoad, swapCandidates, type Deload } from './progression';
import { EXERCISE_LIBRARY, findExercise } from './data/exercises';
import type { SetEntry, WorkoutLogEntry } from './types';

function workout(date: string, exerciseId: string, sets: SetEntry[]): WorkoutLogEntry {
  return { id: `w-${date}-${exerciseId}`, date, workoutName: 'Session', durationMin: 60, exerciseLogs: [{ exerciseId, exerciseName: exerciseId, sets }] };
}
const at = (kg: number, reps = [8, 7, 7]) => reps.map((r) => ({ weightKg: kg, reps: r }));

const bench = { equipment: 'Barbell', reps: '6-10' };
const stalled = [
  workout('2026-09-01', 'bench-press', at(80)),
  workout('2026-09-05', 'bench-press', at(80)),
  workout('2026-09-09', 'bench-press', at(80)),
];
const deload: Deload = { exerciseId: 'bench-press', stalledKg: 80, deloadKg: 72.5, createdOn: '2026-09-10' };

describe('deloadWeight', () => {
  it('takes about 10% off, snapped to what the equipment can load', () => {
    expect(deloadWeight(80, 'Barbell')).toBe(72.5); // 72 → nearest 2.5
    expect(deloadWeight(100, 'Barbell')).toBe(90);
    expect(deloadWeight(24, 'Dumbbells')).toBe(22); // 21.6 → nearest 2
    expect(deloadWeight(24, 'Kettlebell')).toBe(20); // 21.6 → nearest 4
  });

  it('is always strictly lighter, even when 10% rounds back up to the same weight', () => {
    // 10% of 10 kg is 1 kg; snapping 9 to the barbell's 2.5 steps would give 10 again.
    expect(deloadWeight(10, 'Barbell')).toBe(7.5);
    expect(deloadWeight(12, 'Dumbbells')).toBe(10); // 10.8 → 10
  });

  it('offers nothing when no lighter weight can be loaded', () => {
    expect(deloadWeight(2, 'Dumbbells')).toBeNull(); // the lightest pair there is
    expect(deloadWeight(2.5, 'Barbell')).toBeNull();
    expect(deloadWeight(4, 'Dumbbells')).toBe(2);
  });

  it('uses 1 kg steps for weighted bodyweight work', () => {
    expect(deloadWeight(20, 'Bodyweight')).toBe(18);
  });
});

describe('suggestNextLoad with a deload', () => {
  const last = lastPerformance(stalled, 'bench-press')!;

  it('suggests the deload weight at the top of the rep range', () => {
    const s = suggestNextLoad(last, bench, stalled, deload)!;
    expect(s.action).toBe('deload');
    expect(s.weightKg).toBe(72.5);
    expect(s.targetReps).toBe(10);
    expect(s.previous.weightKg).toBe(80);
  });

  it('ignores a deload for a different lift', () => {
    const s = suggestNextLoad(last, bench, stalled, { ...deload, exerciseId: 'squat' })!;
    expect(s.action).toBe('add_reps');
  });

  it('builds back by ordinary double progression once the deload session is logged', () => {
    const after = [...stalled, workout('2026-09-12', 'bench-press', at(72.5, [10, 10, 10]))];
    const s = suggestNextLoad(lastPerformance(after, 'bench-press')!, bench, after, deload)!;
    // Last top weight is no longer the stalled one, so the deload is spent.
    expect(s.action).toBe('increase_weight');
    expect(s.weightKg).toBe(75);
  });
});

describe('isDeloadActive', () => {
  it('stays active while the last session is still at the stalled weight', () => {
    expect(isDeloadActive(deload, stalled)).toBe(true);
    // Skipping it and grinding 80 again doesn't use it up.
    expect(isDeloadActive(deload, [...stalled, workout('2026-09-12', 'bench-press', at(80))])).toBe(true);
  });

  it('ends once any other top weight is logged — lighter or heavier', () => {
    expect(isDeloadActive(deload, [...stalled, workout('2026-09-12', 'bench-press', at(72.5))])).toBe(false);
    expect(isDeloadActive(deload, [...stalled, workout('2026-09-12', 'bench-press', at(82.5))])).toBe(false);
  });

  it('is inactive for a lift with no history', () => {
    expect(isDeloadActive({ ...deload, exerciseId: 'squat' }, stalled)).toBe(false);
  });
});

describe('swapCandidates', () => {
  const lib = EXERCISE_LIBRARY;
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

  it('offers true substitutes first: squats for a squat, not calf raises', () => {
    const { close, other } = swapCandidates(findExercise('squat')!, lib);
    expect(ids(close).sort()).toEqual(['front-squat', 'goblet-squat', 'leg-press']);
    // The rest of "legs" is still offered — but separately, not as an equivalent.
    expect(ids(other)).toEqual(expect.arrayContaining(['leg-curl', 'calf-raise']));
    expect(ids(close)).not.toContain('calf-raise');
  });

  it('crosses the library’s categories where the movement does', () => {
    // Deadlift is filed under back, RDL and sumo under glutes; all three are hinges.
    expect(ids(swapCandidates(findExercise('deadlift')!, lib).close)).toEqual(expect.arrayContaining(['rdl', 'sumo-deadlift', 'rack-pull']));
  });

  it('lists different equipment first within each group', () => {
    const { close } = swapCandidates(findExercise('bench-press')!, lib);
    const firstBarbell = close.findIndex((e) => e.equipment === 'Barbell');
    expect(firstBarbell).toBeGreaterThan(0);
    expect(close.slice(firstBarbell).every((e) => e.equipment === 'Barbell')).toBe(true);
  });

  it('never trades a rep-counted lift for a timed hold, or the reverse', () => {
    for (const ex of lib) {
      const timed = parseRepRange(ex.reps) === null;
      const { close, other } = swapCandidates(ex, lib);
      for (const alt of [...close, ...other]) expect(parseRepRange(alt.reps) === null).toBe(timed);
    }
  });

  it('every library exercise has a movement pattern and at least one alternative', () => {
    expect(lib.filter((e) => !MOVEMENT_PATTERN[e.id]).map((e) => e.id)).toEqual([]);
    const stranded = lib.filter((e) => {
      const { close, other } = swapCandidates(e, lib);
      return close.length + other.length === 0;
    });
    expect(stranded.map((e) => e.id)).toEqual([]);
  });
});
