import { describe, expect, it } from 'vitest';
import {
  incrementForEquipment,
  lastPerformance,
  parseRepRange,
  suggestNextLoad,
  type LastPerformance,
} from './progression';
import { EXERCISE_LIBRARY } from './data/exercises';
import type { SetEntry, WorkoutLogEntry } from './types';

function workout(date: string, exerciseId: string, sets: SetEntry[]): WorkoutLogEntry {
  return {
    id: `w-${date}-${exerciseId}`,
    date,
    workoutName: 'Session',
    durationMin: 60,
    exerciseLogs: [{ exerciseId, exerciseName: exerciseId, sets }],
  };
}

const bench = { equipment: 'Barbell', reps: '6-10' };

describe('parseRepRange', () => {
  it.each([
    ['6-10', { min: 6, max: 10 }],
    ['8-12', { min: 8, max: 12 }],
    ['12-20', { min: 12, max: 20 }],
    ['10-12/leg', { min: 10, max: 12 }],
    ['12-15/side', { min: 12, max: 15 }],
    ['10/side', { min: 10, max: 10 }],
    ['20 total', { min: 20, max: 20 }],
  ])('parses %s', (input, expected) => {
    expect(parseRepRange(input)).toEqual(expected);
  });

  it.each(['20-30s', '30-60s', '45 s'])('treats %s as a timed hold, not reps', (input) => {
    expect(parseRepRange(input)).toBeNull();
  });

  it('does not mistake "/side" for seconds', () => {
    expect(parseRepRange('10-12/side')).toEqual({ min: 10, max: 12 });
  });

  it('returns null for missing or unparseable reps', () => {
    expect(parseRepRange(undefined)).toBeNull();
    expect(parseRepRange('as many as possible')).toBeNull();
  });

  it('parses every rep string in the shipped exercise library without throwing', () => {
    for (const exercise of EXERCISE_LIBRARY) {
      const range = parseRepRange(exercise.reps);
      if (range) {
        expect(range.min).toBeGreaterThan(0);
        expect(range.max).toBeGreaterThanOrEqual(range.min);
      }
    }
  });
});

describe('incrementForEquipment', () => {
  it.each([
    ['Barbell', 2.5],
    ['Barbell/EZ-Bar', 2.5],
    ['Barbell/T-Bar Machine', 2.5],
    ['Dumbbells', 2],
    ['Kettlebell', 4],
    ['Machine', 2.5],
    ['Cable Machine', 2.5],
    ['Cable/Band', 2.5],
    ['Bodyweight', 0],
    ['Pull-up Bar', 0],
  ])('%s steps by %s kg', (equipment, expected) => {
    expect(incrementForEquipment(equipment)).toBe(expected);
  });

  it('prefers the loadable half of a combined entry', () => {
    // "Bodyweight/Barbell" is a lift that can be loaded, so weight is what should progress.
    expect(incrementForEquipment('Bodyweight/Barbell')).toBe(2.5);
    expect(incrementForEquipment('Bodyweight/Plate')).toBe(2.5);
    expect(incrementForEquipment('Kettlebell/Dumbbell')).toBe(4);
  });
});

describe('lastPerformance', () => {
  const logs = [
    workout('2026-09-01', 'bench-press', [{ weightKg: 60, reps: 8 }]),
    workout('2026-09-05', 'bench-press', [{ weightKg: 65, reps: 6 }]),
    workout('2026-09-03', 'squat', [{ weightKg: 100, reps: 5 }]),
  ];

  it('finds the most recent session for the exercise', () => {
    expect(lastPerformance(logs, 'bench-press')?.date).toBe('2026-09-05');
  });

  it('is not confused by other exercises logged later', () => {
    expect(lastPerformance(logs, 'squat')?.date).toBe('2026-09-03');
  });

  it('returns null for an exercise never logged', () => {
    expect(lastPerformance(logs, 'deadlift')).toBeNull();
  });

  it('skips sessions that recorded the exercise but no sets', () => {
    const withEmpty = [...logs, workout('2026-09-09', 'bench-press', [])];
    expect(lastPerformance(withEmpty, 'bench-press')?.date).toBe('2026-09-05');
  });
});

describe('suggestNextLoad', () => {
  const perf = (sets: SetEntry[], date = '2026-09-05'): LastPerformance => ({
    date,
    log: { exerciseId: 'bench-press', exerciseName: 'Bench', sets },
  });

  it('adds weight once every set hits the top of the range', () => {
    const s = suggestNextLoad(perf([{ weightKg: 60, reps: 10 }, { weightKg: 60, reps: 10 }]), bench);
    expect(s).toMatchObject({ action: 'increase_weight', weightKg: 62.5, targetReps: 6, incrementKg: 2.5 });
  });

  it('holds the weight and asks for one more rep when a set fell short', () => {
    const s = suggestNextLoad(perf([{ weightKg: 60, reps: 10 }, { weightKg: 60, reps: 8 }]), bench);
    // Target is driven by the weakest set — that's the one that has to improve.
    expect(s).toMatchObject({ action: 'add_reps', weightKg: 60, targetReps: 9 });
  });

  it('never asks for more than the top of the range', () => {
    const s = suggestNextLoad(perf([{ weightKg: 60, reps: 10 }, { weightKg: 60, reps: 9 }]), bench);
    expect(s?.targetReps).toBe(10);
  });

  it('uses the heaviest set as the working weight', () => {
    // Warm-up sets get logged too; the suggestion has to be about the working weight.
    const s = suggestNextLoad(perf([{ weightKg: 40, reps: 10 }, { weightKg: 60, reps: 10 }]), bench);
    expect(s?.previous.weightKg).toBe(60);
  });

  it('steps a dumbbell lift by its own increment, not the barbell one', () => {
    const s = suggestNextLoad(perf([{ weightKg: 20, reps: 12 }]), { equipment: 'Dumbbells', reps: '8-12' });
    expect(s).toMatchObject({ action: 'increase_weight', weightKg: 22, incrementKg: 2 });
  });

  it('holds a topped-out bodyweight exercise instead of inventing a weight', () => {
    const s = suggestNextLoad(perf([{ weightKg: 0, reps: 20 }]), { equipment: 'Bodyweight', reps: '12-20' });
    expect(s).toMatchObject({ action: 'hold', weightKg: 0, targetReps: 20 });
  });

  it('still adds reps to a bodyweight exercise below the range top', () => {
    const s = suggestNextLoad(perf([{ weightKg: 0, reps: 14 }]), { equipment: 'Bodyweight', reps: '12-20' });
    expect(s).toMatchObject({ action: 'add_reps', targetReps: 15 });
  });

  it('declines to suggest anything for a timed hold', () => {
    expect(suggestNextLoad(perf([{ weightKg: 0, reps: 45 }]), { equipment: 'Bodyweight', reps: '30-60s' })).toBeNull();
  });

  it('declines when the session recorded no sets', () => {
    expect(suggestNextLoad(perf([]), bench)).toBeNull();
  });

  it('reports what was done last time so the UI can show it', () => {
    const s = suggestNextLoad(perf([{ weightKg: 60, reps: 10 }, { weightKg: 60, reps: 8 }]), bench);
    expect(s?.previous).toEqual({ weightKg: 60, reps: [10, 8] });
  });

  describe('stall detection', () => {
    it('counts consecutive sessions stuck at the same weight', () => {
      const history = [
        workout('2026-09-01', 'bench-press', [{ weightKg: 60, reps: 8 }]),
        workout('2026-09-03', 'bench-press', [{ weightKg: 60, reps: 8 }]),
        workout('2026-09-05', 'bench-press', [{ weightKg: 60, reps: 9 }]),
      ];
      const s = suggestNextLoad(perf([{ weightKg: 60, reps: 9 }]), bench, history);
      expect(s?.sessionsAtWeight).toBe(3);
    });

    it('resets the count when the weight last changed', () => {
      const history = [
        workout('2026-09-01', 'bench-press', [{ weightKg: 55, reps: 10 }]),
        workout('2026-09-03', 'bench-press', [{ weightKg: 60, reps: 7 }]),
        workout('2026-09-05', 'bench-press', [{ weightKg: 60, reps: 8 }]),
      ];
      const s = suggestNextLoad(perf([{ weightKg: 60, reps: 8 }]), bench, history);
      expect(s?.sessionsAtWeight).toBe(2);
    });

    it('reports one session when there is no history to compare against', () => {
      expect(suggestNextLoad(perf([{ weightKg: 60, reps: 8 }]), bench)?.sessionsAtWeight).toBe(1);
    });
  });
});
