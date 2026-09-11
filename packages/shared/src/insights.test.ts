import { describe, expect, it } from 'vitest';
import { deriveInsights, type Insight, type InsightId, type InsightInput } from './insights';
import { addDaysISO, planDailyTargets } from './calc';
import type { FoodEntry, Profile, WorkoutLogEntry } from './types';

const TODAY = '2026-09-11';

const profile: Profile = {
  name: 'Test',
  age: 30,
  sex: 'male',
  heightCm: 180,
  weightKg: 84,
  goal: 'lose_fat',
  targetWeightKg: 78,
  timeframeWeeks: 20,
  expectations: '',
  activityLevel: 'moderate',
  preferredDaysPerWeek: 4,
  unitSystem: 'metric',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const targets = planDailyTargets(profile);

function food(date: string, calories: number, proteinG: number): FoodEntry {
  return {
    id: `f-${date}-${calories}-${proteinG}`,
    date,
    meal: 'lunch',
    name: 'Meal',
    quantity: 1,
    calories,
    proteinG,
    carbsG: 50,
    fatG: 20,
    source: 'manual',
    loggedAt: `${date}T12:00:00.000Z`,
  };
}

/** `days` full days of eating, ending today. */
function eatingDays(count: number, calories: number, proteinG: number): FoodEntry[] {
  return Array.from({ length: count }, (_, i) => food(addDaysISO(TODAY, -i), calories, proteinG));
}

/** Weigh-ins every day for `count` days, moving `kgPerWeek`. */
function weighIns(count: number, startKg: number, kgPerWeek: number) {
  return Array.from({ length: count }, (_, i) => ({
    date: addDaysISO(TODAY, -(count - 1 - i)),
    weightKg: startKg + (kgPerWeek / 7) * i,
  }));
}

function session(date: string, exerciseId: string, name: string, topWeightKg: number): WorkoutLogEntry {
  return {
    id: `w-${date}-${exerciseId}`,
    date,
    workoutName: 'Session',
    durationMin: 55,
    exerciseLogs: [
      { exerciseId, exerciseName: name, sets: [{ weightKg: topWeightKg, reps: 8 }, { weightKg: topWeightKg, reps: 7 }] },
    ],
  };
}

function nights(count: number, hours: number) {
  return Array.from({ length: count }, (_, i) => ({ date: addDaysISO(TODAY, -i), hours }));
}

function run(over: Partial<InsightInput> = {}): Insight[] {
  return deriveInsights({
    profile,
    foodEntries: [],
    workoutLogs: [],
    weights: [],
    sleep: [],
    today: TODAY,
    ...over,
  });
}

const ids = (list: Insight[]): InsightId[] => list.map((i) => i.id);
const find = (list: Insight[], id: InsightId) => list.find((i) => i.id === id);

describe('deriveInsights', () => {
  it('says nothing at all for a user with no data', () => {
    expect(run()).toEqual([]);
  });

  describe('losing too fast', () => {
    it('warns when the trend beats 1% of bodyweight a week', () => {
      // 84kg, so the safe cap is 0.84 kg/week.
      const list = run({ weights: weighIns(21, 90, -1.4) });
      const insight = find(list, 'losing_too_fast');
      expect(insight?.tone).toBe('warning');
      expect(insight?.detail).toContain('1.40 kg a week');
    });

    it('stays quiet at a sustainable rate', () => {
      expect(ids(run({ weights: weighIns(21, 86, -0.5) }))).not.toContain('losing_too_fast');
    });

    it('stays quiet without enough weigh-ins', () => {
      const sparse = weighIns(21, 90, -1.4).filter((_, i) => i % 5 === 0);
      expect(ids(run({ weights: sparse }))).not.toContain('losing_too_fast');
    });

    it('outranks everything else', () => {
      const list = run({
        weights: weighIns(21, 90, -1.4),
        foodEntries: eatingDays(20, 2000, 40),
        sleep: nights(20, 5),
      });
      expect(list[0].id).toBe('losing_too_fast');
    });
  });

  describe('protein', () => {
    it('flags a consistent shortfall, quoting the count', () => {
      const list = run({ foodEntries: eatingDays(20, 2200, 40) });
      const insight = find(list, 'protein_short');
      expect(insight).toBeDefined();
      expect(insight?.detail).toContain(`${targets.proteinG}g`);
      expect(insight?.detail).toContain('0 of the last 20 logged days');
    });

    it('stays quiet when protein is being hit', () => {
      const list = run({ foodEntries: eatingDays(20, 2200, targets.proteinG) });
      expect(ids(list)).not.toContain('protein_short');
    });

    it('allows a little slack rather than demanding the exact number', () => {
      const list = run({ foodEntries: eatingDays(20, 2200, Math.round(targets.proteinG * 0.9)) });
      expect(ids(list)).not.toContain('protein_short');
    });

    it('stays quiet below the evidence floor', () => {
      expect(ids(run({ foodEntries: eatingDays(6, 2200, 40) }))).not.toContain('protein_short');
    });

    it('ignores partial days instead of averaging them in', () => {
      // 20 good days plus 8 breakfast-only days. The good days all hit protein, so the only way
      // this fires is if the partial days were counted as real days of eating.
      const good = eatingDays(20, 2200, targets.proteinG);
      const partial = Array.from({ length: 8 }, (_, i) => food(addDaysISO(TODAY, -(20 + i)), 300, 10));
      expect(ids(run({ foodEntries: [...good, ...partial] }))).not.toContain('protein_short');
    });

    it('does not nag an endurance goal about protein', () => {
      const endurance = { ...profile, goal: 'improve_endurance' as const };
      const list = run({ profile: endurance, foodEntries: eatingDays(20, 2200, 40) });
      expect(ids(list)).not.toContain('protein_short');
    });
  });

  describe('stalled weight', () => {
    it('flags a flat month when the user wants to change', () => {
      const list = run({ weights: weighIns(25, 84, 0) });
      const insight = find(list, 'weight_stalled');
      expect(insight?.detail).toContain('lose');
    });

    it('says gain when the goal is upward', () => {
      const bulking = { ...profile, goal: 'build_muscle' as const, weightKg: 70, targetWeightKg: 76 };
      const list = run({ profile: bulking, weights: weighIns(25, 70, 0) });
      expect(find(list, 'weight_stalled')?.detail).toContain('gain');
    });

    it('stays quiet for someone maintaining on purpose', () => {
      const maintaining = { ...profile, goal: 'maintain' as const, targetWeightKg: 84 };
      expect(ids(run({ profile: maintaining, weights: weighIns(25, 84, 0) }))).not.toContain('weight_stalled');
    });

    it('stays quiet when the weight is actually moving', () => {
      expect(ids(run({ weights: weighIns(25, 86, -0.4) }))).not.toContain('weight_stalled');
    });

    it('needs three weeks before calling it, not two', () => {
      expect(ids(run({ weights: weighIns(16, 84, 0) }))).not.toContain('weight_stalled');
    });
  });

  describe('stalled lifts', () => {
    const stalledBench = [
      session(addDaysISO(TODAY, -14), 'bench-press', 'Bench Press', 80),
      session(addDaysISO(TODAY, -9), 'bench-press', 'Bench Press', 80),
      session(addDaysISO(TODAY, -4), 'bench-press', 'Bench Press', 80),
    ];

    it('names the lift, the weight and the session count', () => {
      const list = run({ workoutLogs: stalledBench });
      const insight = find(list, 'lift_stalled');
      expect(insight?.title).toContain('Bench Press');
      expect(insight?.detail).toContain('80 kg');
      expect(insight?.detail).toContain('3 sessions');
    });

    it('needs three sessions at the weight, not two', () => {
      expect(ids(run({ workoutLogs: stalledBench.slice(1) }))).not.toContain('lift_stalled');
    });

    it('stays quiet for a lift that is still climbing', () => {
      const climbing = [
        session(addDaysISO(TODAY, -14), 'squat', 'Squat', 100),
        session(addDaysISO(TODAY, -9), 'squat', 'Squat', 102.5),
        session(addDaysISO(TODAY, -4), 'squat', 'Squat', 105),
      ];
      expect(ids(run({ workoutLogs: climbing }))).not.toContain('lift_stalled');
    });

    it('reports only the worst stall rather than every plateau', () => {
      const alsoStalled = [
        session(addDaysISO(TODAY, -20), 'ohp', 'Overhead Press', 50),
        session(addDaysISO(TODAY, -15), 'ohp', 'Overhead Press', 50),
        session(addDaysISO(TODAY, -10), 'ohp', 'Overhead Press', 50),
        session(addDaysISO(TODAY, -5), 'ohp', 'Overhead Press', 50),
      ];
      const list = run({ workoutLogs: [...stalledBench, ...alsoStalled] });
      expect(list.filter((i) => i.id === 'lift_stalled')).toHaveLength(1);
      expect(find(list, 'lift_stalled')?.title).toContain('Overhead Press'); // 4 sessions beats 3
    });

    it('ignores bodyweight work, which has no load to stall at', () => {
      const pullups = [
        session(addDaysISO(TODAY, -14), 'pull-up', 'Pull-Up', 0),
        session(addDaysISO(TODAY, -9), 'pull-up', 'Pull-Up', 0),
        session(addDaysISO(TODAY, -4), 'pull-up', 'Pull-Up', 0),
      ];
      expect(ids(run({ workoutLogs: pullups }))).not.toContain('lift_stalled');
    });
  });

  describe('sleep', () => {
    it('flags a short average', () => {
      expect(find(run({ sleep: nights(20, 5.8) }), 'sleep_short')?.detail).toContain('5.8 hours');
    });

    it('stays quiet at a reasonable average', () => {
      expect(ids(run({ sleep: nights(20, 7.2) }))).not.toContain('sleep_short');
    });

    it('stays quiet below the evidence floor', () => {
      expect(ids(run({ sleep: nights(5, 5) }))).not.toContain('sleep_short');
    });
  });

  describe('wins', () => {
    it('celebrates a lift that has gone up', () => {
      const climbing = [
        session(addDaysISO(TODAY, -20), 'squat', 'Squat', 100),
        session(addDaysISO(TODAY, -10), 'squat', 'Squat', 105),
        session(addDaysISO(TODAY, -2), 'squat', 'Squat', 110),
      ];
      expect(find(run({ workoutLogs: climbing }), 'lift_progressing')?.title).toContain('up 10 kg');
    });

    it('celebrates consistency', () => {
      const list = run({ foodEntries: eatingDays(28, 2200, targets.proteinG) });
      expect(find(list, 'strong_consistency')?.title).toContain('of the last 29 days logged');
    });

    it('never celebrates the same lift it just called stalled', () => {
      // Climbed for a fortnight, then flat for three sessions. Both statements are true, but
      // shown together they read as the app contradicting itself.
      const climbedThenStalled = [
        session(addDaysISO(TODAY, -24), 'bench-press', 'Bench Press', 70),
        session(addDaysISO(TODAY, -19), 'bench-press', 'Bench Press', 75),
        session(addDaysISO(TODAY, -12), 'bench-press', 'Bench Press', 80),
        session(addDaysISO(TODAY, -7), 'bench-press', 'Bench Press', 80),
        session(addDaysISO(TODAY, -2), 'bench-press', 'Bench Press', 80),
      ];
      const list = run({ workoutLogs: climbedThenStalled });
      expect(ids(list)).toContain('lift_stalled');
      expect(ids(list)).not.toContain('lift_progressing');
    });

    it('still celebrates a different lift that is climbing', () => {
      const stalledBench = [
        session(addDaysISO(TODAY, -12), 'bench-press', 'Bench Press', 80),
        session(addDaysISO(TODAY, -7), 'bench-press', 'Bench Press', 80),
        session(addDaysISO(TODAY, -2), 'bench-press', 'Bench Press', 80),
      ];
      const climbingSquat = [
        session(addDaysISO(TODAY, -20), 'squat', 'Squat', 100),
        session(addDaysISO(TODAY, -3), 'squat', 'Squat', 110),
      ];
      const list = run({ workoutLogs: [...stalledBench, ...climbingSquat] });
      expect(find(list, 'lift_stalled')?.title).toContain('Bench Press');
      expect(find(list, 'lift_progressing')?.title).toContain('Squat');
    });

    it('shows at most one win, so praise never crowds out advice', () => {
      const climbing = [
        session(addDaysISO(TODAY, -20), 'squat', 'Squat', 100),
        session(addDaysISO(TODAY, -2), 'squat', 'Squat', 110),
      ];
      const list = run({ workoutLogs: climbing, foodEntries: eatingDays(28, 2200, targets.proteinG) });
      expect(list.filter((i) => i.tone === 'win')).toHaveLength(1);
    });

    it('never puts a win above something actionable', () => {
      const climbing = [
        session(addDaysISO(TODAY, -20), 'squat', 'Squat', 100),
        session(addDaysISO(TODAY, -2), 'squat', 'Squat', 110),
      ];
      const list = run({ workoutLogs: climbing, foodEntries: eatingDays(28, 2200, 40), sleep: nights(20, 5) });
      expect(list[list.length - 1].tone).toBe('win');
      expect(list[0].tone).not.toBe('win');
    });
  });

  it('sorts by priority, most important first', () => {
    const list = run({
      weights: weighIns(25, 90, -1.4),
      foodEntries: eatingDays(20, 2000, 40),
      sleep: nights(20, 5),
      workoutLogs: [
        session(addDaysISO(TODAY, -14), 'bench-press', 'Bench Press', 80),
        session(addDaysISO(TODAY, -9), 'bench-press', 'Bench Press', 80),
        session(addDaysISO(TODAY, -4), 'bench-press', 'Bench Press', 80),
      ],
    });
    const priorities = list.map((i) => i.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
    expect(list[0].id).toBe('losing_too_fast');
  });

  it('measures protein against the measured target when there is one', () => {
    // A lower measured maintenance means a lower calorie target, but protein is set from
    // bodyweight, so the protein insight must not silently move with it.
    const withMeasured = run({ foodEntries: eatingDays(20, 2200, 40), measuredTDEE: 2200 });
    expect(find(withMeasured, 'protein_short')?.detail).toContain(`${targets.proteinG}g`);
  });

  it('ignores data outside the window', () => {
    const old = Array.from({ length: 20 }, (_, i) => food(addDaysISO(TODAY, -(60 + i)), 2200, 20));
    expect(run({ foodEntries: old })).toEqual([]);
  });
});
