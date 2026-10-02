import { describe, expect, it } from 'vitest';
import { findPersonalRecords, recordsForLog } from './records';
import type { SetEntry, WorkoutLogEntry } from './types';

const ex = (sets: SetEntry[], id = 'bench-press', name = 'Bench Press') => ({ exerciseId: id, exerciseName: name, sets });
const day = (date: string, sets: SetEntry[], id = 'bench-press'): WorkoutLogEntry => ({
  id: `${date}-${id}`, date, workoutName: 'Session', durationMin: 50, exerciseLogs: [ex(sets, id)],
});
const at = (weightKg: number, ...reps: number[]) => reps.map((r) => ({ weightKg, reps: r }));
const history = [day('2026-09-20', at(80, 8, 8, 7)), day('2026-09-24', at(82.5, 6, 5))];

describe('findPersonalRecords', () => {
  it('a heavier weight than ever is the headline record', () => {
    const [r] = findPersonalRecords([ex(at(85, 5, 4))], history, 'metric');
    expect(r).toMatchObject({ kind: 'heaviest', headline: 'Heaviest ever: 85 kg × 5', detail: 'previous best 82.5 kg' });
  });

  it('a stronger set at a weight already lifted is a best set', () => {
    // 80 × 10 → est. 107 kg, beating the old best estimate, 80 × 8 → 101 kg (82.5 × 6 is only 99).
    const [r] = findPersonalRecords([ex(at(80, 10, 9))], history, 'metric');
    expect(r).toMatchObject({ kind: 'best_set', headline: 'Best set: 80 kg × 10', detail: 'estimated 1RM 107 kg, up from 101 kg' });
  });

  it('does not trust the 1RM estimate past 12 reps — that is a rep record instead', () => {
    const past = [day('2026-09-20', at(40, 15))];
    const [r] = findPersonalRecords([ex(at(40, 20))], past, 'metric');
    // 40 × 20 would "estimate" 67 kg; reported for what it is.
    expect(r).toMatchObject({ kind: 'most_reps', headline: 'Most reps at 40 kg: 20', detail: 'previous best 15' });
  });

  it('counts most reps for bodyweight work', () => {
    const past = [day('2026-09-20', at(0, 12, 10), 'pull-up')];
    const [r] = findPersonalRecords([ex(at(0, 14, 11), 'pull-up', 'Pull-up')], past, 'metric');
    expect(r).toMatchObject({ kind: 'most_reps', headline: 'Most reps: 14', detail: 'previous best 12' });
  });

  it('the first time an exercise is logged is a baseline, not a record', () => {
    expect(findPersonalRecords([ex(at(60, 8), 'squat', 'Squat')], history, 'metric')).toEqual([]);
  });

  it('matching or trailing the best is not a record, nor is rounding noise', () => {
    expect(findPersonalRecords([ex(at(82.5, 6))], history, 'metric')).toEqual([]);
    expect(findPersonalRecords([ex(at(80, 8))], history, 'metric')).toEqual([]);
  });

  it('reports one record per exercise, the most meaningful', () => {
    const records = findPersonalRecords([ex(at(85, 5)), ex(at(0, 14), 'pull-up', 'Pull-up')],
      [...history, day('2026-09-20', at(0, 12), 'pull-up')], 'metric');
    expect(records.map((r) => [r.exerciseName, r.kind])).toEqual([['Bench Press', 'heaviest'], ['Pull-up', 'most_reps']]);
  });

  it('first loaded set on a bodyweight exercise counts as heaviest', () => {
    const past = [day('2026-09-20', at(0, 12), 'pull-up')];
    const [r] = findPersonalRecords([ex(at(5, 8), 'pull-up', 'Pull-up')], past, 'metric');
    expect(r).toMatchObject({ kind: 'heaviest', detail: 'first time adding weight' });
  });

  it('speaks the user’s unit', () => {
    const [r] = findPersonalRecords([ex(at(85, 5))], history, 'imperial');
    expect(r.headline).toBe('Heaviest ever: 187.4 lb × 5');
    expect(r.detail).toBe('previous best 181.9 lb');
  });

  it('ignores zero-rep sets (a failed attempt logged as 0)', () => {
    expect(findPersonalRecords([ex([{ weightKg: 100, reps: 0 }])], history, 'metric')).toEqual([]);
  });
});

describe('recordsForLog', () => {
  it('judges a logged session only against earlier days', () => {
    const later = day('2026-09-28', at(85, 5));
    const all = [...history, later, day('2026-10-01', at(90, 3))];
    expect(recordsForLog(later, all, 'metric').map((r) => r.kind)).toEqual(['heaviest']);
  });
});
