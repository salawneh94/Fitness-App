import { describe, expect, it } from 'vitest';
import { estimateAdaptiveTDEE, isAdaptiveTDEE, type AdaptiveTDEEUnavailable } from './adaptiveTdee';
import { addDaysISO, calcTDEE, planDailyTargets } from './calc';
import type { Profile } from './types';

const TODAY = '2026-09-05';

const profile: Profile = {
  name: 'Test',
  age: 30,
  sex: 'male',
  heightCm: 180,
  weightKg: 80,
  goal: 'lose_fat',
  targetWeightKg: 75,
  timeframeWeeks: 20,
  expectations: '',
  activityLevel: 'moderate',
  preferredDaysPerWeek: 4,
  unitSystem: 'metric',
  createdAt: '2026-01-01T00:00:00.000Z',
};

/** Weigh-ins every `every` days going back `days`, on a straight line of `slopePerDay` kg/day. */
function weighIns(days: number, startWeight: number, slopePerDay: number, every = 1, noise: number[] = []) {
  const out: { date: string; weightKg: number }[] = [];
  for (let i = days; i >= 0; i -= every) {
    const offset = days - i;
    out.push({
      date: addDaysISO(TODAY, -i),
      weightKg: startWeight + slopePerDay * offset + (noise[out.length] ?? 0),
    });
  }
  return out;
}

function intake(days: number, calories: number, skip: number[] = []) {
  const out: { date: string; calories: number }[] = [];
  for (let i = days; i >= 0; i--) {
    if (skip.includes(i)) continue;
    out.push({ date: addDaysISO(TODAY, -i), calories });
  }
  return out;
}

describe('estimateAdaptiveTDEE', () => {
  it('recovers maintenance when weight is flat: TDEE equals mean intake', () => {
    const result = estimateAdaptiveTDEE(profile, weighIns(21, 80, 0), intake(21, 2400), TODAY);
    expect(isAdaptiveTDEE(result)).toBe(true);
    if (!isAdaptiveTDEE(result)) return;
    expect(result.tdee).toBe(2400);
    expect(result.observedWeeklyChangeKg).toBeCloseTo(0, 6);
    expect(result.clamped).toBe(false);
  });

  it('reads a deficit: losing 0.5kg/week on 2000kcal means burning ~2550', () => {
    // 0.5 kg/week = 0.0714 kg/day = 550 kcal/day released from stores.
    const result = estimateAdaptiveTDEE(profile, weighIns(21, 80, -0.5 / 7), intake(21, 2000), TODAY);
    if (!isAdaptiveTDEE(result)) throw new Error('expected an estimate');
    expect(result.observedWeeklyChangeKg).toBeCloseTo(-0.5, 6);
    expect(result.tdee).toBe(2550);
  });

  it('reads a surplus: gaining 0.25kg/week on 3000kcal means burning ~2725', () => {
    const result = estimateAdaptiveTDEE(profile, weighIns(21, 80, 0.25 / 7), intake(21, 3000), TODAY);
    if (!isAdaptiveTDEE(result)) throw new Error('expected an estimate');
    expect(result.tdee).toBe(2725);
  });

  it('sees through realistic day-to-day water weight', () => {
    // Same true trend as the deficit case, with ~±1kg of daily swing on top — larger than the
    // entire real change over three weeks. Deterministic pseudo-random so the bound is meaningful.
    let seed = 42;
    const noise = Array.from({ length: 22 }, () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return (seed / 2147483648) * 2 - 1;
    });
    const noisy = estimateAdaptiveTDEE(profile, weighIns(21, 80, -0.5 / 7, 1, noise), intake(21, 2000), TODAY);
    if (!isAdaptiveTDEE(noisy)) throw new Error('expected an estimate');
    expect(Math.abs(noisy.tdee - 2550)).toBeLessThan(100);
  });

  it('beats endpoint-to-endpoint when a single weigh-in is off', () => {
    // The property that matters isn't an absolute error bound — it's that fitting through every
    // point is dramatically better than trusting the two that happen to sit at the ends. Here the
    // final reading is 1.5kg high, which is a normal amount of water weight and exactly cancels
    // three weeks of real loss.
    const spike = Array(21).fill(0).concat([1.5]);
    const points = weighIns(21, 80, -0.5 / 7, 1, spike);
    const result = estimateAdaptiveTDEE(profile, points, intake(21, 2000), TODAY);
    if (!isAdaptiveTDEE(result)) throw new Error('expected an estimate');

    const first = points[0];
    const last = points[points.length - 1];
    const endpointSlope = (last.weightKg - first.weightKg) / 21;
    const endpointTdee = 2000 - endpointSlope * 7700;

    const fittedError = Math.abs(result.tdee - 2550);
    const endpointError = Math.abs(endpointTdee - 2550);
    expect(endpointError).toBeGreaterThan(500); // the naive reading is badly wrong here
    expect(fittedError).toBeLessThan(endpointError / 3);
  });

  describe('refuses to answer without enough evidence', () => {
    it('too few weigh-ins', () => {
      const r = estimateAdaptiveTDEE(profile, weighIns(21, 80, 0, 7), intake(21, 2400), TODAY);
      expect((r as AdaptiveTDEEUnavailable).reason).toBe('not_enough_weigh_ins');
    });

    it('span too short', () => {
      const r = estimateAdaptiveTDEE(profile, weighIns(9, 80, 0), intake(9, 2400), TODAY);
      expect((r as AdaptiveTDEEUnavailable).reason).toBe('span_too_short');
    });

    it('too few logged days', () => {
      const sparse = intake(21, 2400).filter((_, i) => i % 3 === 0);
      const r = estimateAdaptiveTDEE(profile, weighIns(21, 80, 0), sparse, TODAY);
      expect((r as AdaptiveTDEEUnavailable).reason).toBe('not_enough_intake_days');
    });

    it('reports how many more days are needed', () => {
      const r = estimateAdaptiveTDEE(profile, weighIns(21, 80, 0), intake(21, 2400).slice(0, 4), TODAY);
      const gap = r as AdaptiveTDEEUnavailable;
      expect(gap.reason).toBe('not_enough_intake_days');
      expect(gap.shortfall).toBe(6);
    });
  });

  describe('under-logging safety', () => {
    it('rejects a window where too many days are missing, rather than under-estimating', () => {
      // 12 logged days out of 22 is under the coverage bar. Enough days to pass the count check,
      // so only the coverage rule stands between the user and a too-low target.
      const skipped = Array.from({ length: 10 }, (_, i) => i * 2);
      const r = estimateAdaptiveTDEE(profile, weighIns(21, 80, 0), intake(21, 2400, skipped), TODAY);
      expect((r as AdaptiveTDEEUnavailable).reason).toBe('intake_coverage_too_low');
    });

    it('drops partial days and counts them against coverage', () => {
      // Someone logs breakfast only on half their days. Those 300kcal days must not drag the mean
      // down; they also must not be silently ignored, or coverage would look fine.
      const full = intake(21, 2400).map((d, i) => (i % 2 === 0 ? d : { ...d, calories: 300 }));
      const r = estimateAdaptiveTDEE(profile, weighIns(21, 80, 0), full, TODAY);
      expect(isAdaptiveTDEE(r)).toBe(false);
      expect((r as AdaptiveTDEEUnavailable).reason).toBe('intake_coverage_too_low');
    });

    it('a fully-logged window with a few partial days still resolves, and ignores their calories', () => {
      const mostly = intake(21, 2400).map((d, i) => (i < 3 ? { ...d, calories: 200 } : d));
      const r = estimateAdaptiveTDEE(profile, weighIns(21, 80, 0), mostly, TODAY);
      if (!isAdaptiveTDEE(r)) throw new Error('expected an estimate');
      expect(r.tdee).toBe(2400); // the 200kcal days are excluded, not averaged in
      expect(r.intakeDays).toBe(19);
    });
  });

  describe('clamping', () => {
    it('pulls an implausibly low measurement back and flags it', () => {
      // 1200kcal/day while gaining weight is not a real metabolism, it's bad data.
      const r = estimateAdaptiveTDEE(profile, weighIns(21, 80, 0.02), intake(21, 1200), TODAY);
      if (!isAdaptiveTDEE(r)) throw new Error('expected an estimate');
      expect(r.clamped).toBe(true);
      expect(r.tdee).toBe(Math.round(calcTDEE(profile) * 0.7));
    });

    it('pulls an implausibly high measurement back and flags it', () => {
      const r = estimateAdaptiveTDEE(profile, weighIns(21, 80, -0.05), intake(21, 5000), TODAY);
      if (!isAdaptiveTDEE(r)) throw new Error('expected an estimate');
      expect(r.clamped).toBe(true);
      expect(r.tdee).toBe(Math.round(calcTDEE(profile) * 1.3));
    });

    it('leaves a plausible measurement alone', () => {
      const formula = calcTDEE(profile);
      const r = estimateAdaptiveTDEE(profile, weighIns(21, 80, 0), intake(21, Math.round(formula * 1.1)), TODAY);
      if (!isAdaptiveTDEE(r)) throw new Error('expected an estimate');
      expect(r.clamped).toBe(false);
    });
  });

  it('ignores weigh-ins older than the window', () => {
    const ancient = [{ date: addDaysISO(TODAY, -400), weightKg: 120 }];
    const r = estimateAdaptiveTDEE(profile, [...ancient, ...weighIns(21, 80, 0)], intake(21, 2400), TODAY);
    if (!isAdaptiveTDEE(r)) throw new Error('expected an estimate');
    expect(r.tdee).toBe(2400); // the 120kg reading would wreck the slope if it were included
    expect(r.weighIns).toBe(22);
  });
});

describe('planDailyTargets with a measured TDEE', () => {
  it('plans against the measurement instead of the formula', () => {
    const measured = 2200;
    const plan = planDailyTargets(profile, measured);
    expect(plan.tdee).toBe(measured);
    expect(plan.tdee).not.toBe(Math.round(calcTDEE(profile)));
  });

  it('still applies the rate cap to a measured figure', () => {
    const impatient: Profile = { ...profile, targetWeightKg: 60, timeframeWeeks: 4 };
    const plan = planDailyTargets(impatient, 2600);
    expect(plan.rateWasCapped).toBe(true);
    // The requested pace is -5kg/week; whatever comes out, it is never faster than the 1%/week
    // limit. (Here the calorie floor then binds too and slows it further — the two rails compose,
    // so asserting an exact rate would be asserting which one happened to win.)
    expect(plan.appliedWeeklyRateKg).toBeGreaterThanOrEqual(-impatient.weightKg * 0.01);
    expect(plan.requestedWeeklyRateKg).toBeLessThan(-1);
  });

  it('lets the calorie floor override the rate cap rather than either being skipped', () => {
    const impatient: Profile = { ...profile, targetWeightKg: 60, timeframeWeeks: 4 };
    const plan = planDailyTargets(impatient, 2600);
    expect(plan.hitCalorieFloor).toBe(true);
    // Rate reported back matches the calories actually prescribed, so the UI can't promise a pace
    // the plan isn't feeding.
    expect(plan.appliedWeeklyRateKg).toBeCloseTo(((plan.calories - 2600) * 7) / 7700, 6);
  });

  it('still applies the calorie floor to a measured figure', () => {
    // A low measurement plus an aggressive target would otherwise drive calories below the floor.
    const plan = planDailyTargets({ ...profile, targetWeightKg: 65, timeframeWeeks: 8 }, 1600);
    expect(plan.hitCalorieFloor).toBe(true);
    expect(plan.calories).toBeGreaterThanOrEqual(1500);
  });

  it('matches the formula path when no measurement is passed', () => {
    expect(planDailyTargets(profile)).toEqual(planDailyTargets(profile, Math.round(calcTDEE(profile))));
  });
});
