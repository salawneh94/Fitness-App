import { describe, expect, it } from 'vitest';
import { deriveInsights, withoutSnoozed, type Insight, type InsightInput } from './insights';
import { addDaysISO } from './calc';
import type { FoodEntry, Profile, WorkoutLogEntry } from './types';

const TODAY = '2026-09-11';

const profile: Profile = {
  name: 'Test', age: 30, sex: 'male', heightCm: 180, weightKg: 84, goal: 'build_muscle', targetWeightKg: 84,
  timeframeWeeks: 20, expectations: '', activityLevel: 'moderate', preferredDaysPerWeek: 4, unitSystem: 'metric',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function session(date: string, exerciseId: string, name: string, topWeightKg: number): WorkoutLogEntry {
  return { id: `w-${date}-${exerciseId}`, date, workoutName: 'Session', durationMin: 55,
    exerciseLogs: [{ exerciseId, exerciseName: name, sets: [{ weightKg: topWeightKg, reps: 8 }] }] };
}
const stalledAt = (exerciseId: string, name: string, kg: number) =>
  [14, 9, 4].map((d) => session(addDaysISO(TODAY, -d), exerciseId, name, kg));

function food(date: string, calories: number, proteinG: number): FoodEntry {
  return { id: `f-${date}`, date, meal: 'lunch', name: 'Meal', quantity: 1, calories, proteinG, carbsG: 300, fatG: 70,
    source: 'manual', loggedAt: `${date}T12:00:00.000Z` };
}

const run = (over: Partial<InsightInput> = {}) =>
  deriveInsights({ profile, foodEntries: [], workoutLogs: [], weights: [], sleep: [], today: TODAY, ...over });
const find = (list: Insight[], id: Insight['id']) => list.find((i) => i.id === id);

describe('lift_stalled action', () => {
  it('offers a concrete deload, sized for the equipment', () => {
    const insight = find(run({ workoutLogs: stalledAt('bench-press', 'Barbell Bench Press', 80) }), 'lift_stalled')!;
    expect(insight.action).toEqual({
      kind: 'deload', label: 'Deload to 72.5 kg', exerciseId: 'bench-press', stalledKg: 80, deloadKg: 72.5,
    });
    // The sentence and the button name the same weight.
    expect(insight.detail).toContain('Dropping to 72.5 kg');
  });

  it('uses the library’s equipment: dumbbell steps for a dumbbell lift', () => {
    const insight = find(run({ workoutLogs: stalledAt('incline-db-press', 'Incline Dumbbell Press', 30) }), 'lift_stalled')!;
    // 27 kg snapped to 2 kg dumbbell steps is 28 — a barbell's 2.5 kg steps would give 27.5.
    expect(insight.action).toMatchObject({ kind: 'deload', deloadKg: 28 });
  });

  it('falls back to barbell steps for a lift the library doesn’t know', () => {
    const insight = find(run({ workoutLogs: stalledAt('custom-lift', 'Custom Lift', 30) }), 'lift_stalled')!;
    expect(insight.action).toMatchObject({ kind: 'deload', deloadKg: 27.5 });
  });

  it('offers no deload when nothing lighter can be loaded, and says something else instead', () => {
    const insight = find(run({ workoutLogs: stalledAt('mystery-curl', 'Mystery Curl', 2.5) }), 'lift_stalled')!;
    expect(insight.action).toBeUndefined();
    expect(insight.detail).toContain('Changing the rep range');
  });

  it('keys the observation by lift and weight, so a new plateau is a new insight', () => {
    const at80 = find(run({ workoutLogs: stalledAt('bench-press', 'Bench', 80) }), 'lift_stalled')!;
    const at85 = find(run({ workoutLogs: stalledAt('bench-press', 'Bench', 85) }), 'lift_stalled')!;
    expect(at80.key).toBe('lift_stalled:bench-press:80');
    expect(at85.key).not.toBe(at80.key);
  });
});

describe('protein_short action', () => {
  it('offers high-protein foods', () => {
    const days = Array.from({ length: 12 }, (_, i) => food(addDaysISO(TODAY, -i), 2600, 60));
    expect(find(run({ foodEntries: days }), 'protein_short')?.action).toEqual({ kind: 'protein_foods', label: 'Show high-protein foods' });
  });
});

describe('units', () => {
  it('speaks pounds to an imperial user — loads, deload and gains alike', () => {
    const imperial = { ...profile, unitSystem: 'imperial' as const };
    const insight = find(run({ profile: imperial, workoutLogs: stalledAt('bench-press', 'Bench', 80) }), 'lift_stalled')!;
    expect(insight.detail).toContain('176.4 lb');
    expect(insight.detail).not.toContain('kg');
    expect(insight.action?.label).toBe('Deload to 159.8 lb');
    // The stored weights stay in kg — only the words change.
    expect(insight.action?.kind === 'deload' && insight.action.deloadKg).toBe(72.5);
  });
});

describe('withoutSnoozed', () => {
  const list = run({ workoutLogs: stalledAt('bench-press', 'Bench', 80) });
  const key = 'lift_stalled:bench-press:80';

  it('hides a snoozed insight until the snooze runs out, then lets it back', () => {
    expect(withoutSnoozed(list, { [key]: '2026-09-18' }, TODAY).map((i) => i.key)).not.toContain(key);
    expect(withoutSnoozed(list, { [key]: '2026-09-18' }, '2026-09-18').map((i) => i.key)).toContain(key);
  });

  it('does not hide a different observation of the same kind', () => {
    const at85 = run({ workoutLogs: stalledAt('bench-press', 'Bench', 85) });
    expect(withoutSnoozed(at85, { [key]: '2026-09-18' }, TODAY).map((i) => i.id)).toContain('lift_stalled');
  });

  it('every insight has a key', () => {
    for (const i of list) expect(i.key).toBeTruthy();
  });
});

describe('plan_complete', () => {
  // Upper/Lower: 10 weeks × 4 days. Started 2026-06-29 → week 11 on 2026-09-11.
  const onPlan = { ...profile, activePlan: { templateId: 'upper-lower', startedOn: '2026-06-29' } };
  const sessions = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `p${i}`, date: addDaysISO('2026-06-29', i * 2), workoutName: 'Upper', durationMin: 50 }));

  it('fires after the last week when the block was actually trained', () => {
    const insight = find(run({ profile: onPlan, workoutLogs: sessions(30) }), 'plan_complete')!;
    expect(insight.title).toBe("You've finished 10 weeks of Upper / Lower Split");
    expect(insight.detail).toContain('30 sessions');
    expect(insight.action).toEqual({ kind: 'browse_plans', label: 'Choose what’s next' });
    expect(insight.key).toBe('plan_complete:upper-lower:2026-06-29');
  });

  it('stays quiet when the weeks went by but the training didn’t', () => {
    // 19 of 40 planned sessions — under half.
    expect(find(run({ profile: onPlan, workoutLogs: sessions(19) }), 'plan_complete')).toBeUndefined();
  });

  it('stays quiet during the block and without a plan', () => {
    const recent = { ...profile, activePlan: { templateId: 'upper-lower', startedOn: '2026-08-31' } };
    expect(find(run({ profile: recent, workoutLogs: sessions(30) }), 'plan_complete')).toBeUndefined();
    expect(find(run({ workoutLogs: sessions(30) }), 'plan_complete')).toBeUndefined();
  });
});
