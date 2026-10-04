import { describe, expect, it } from 'vitest';
import { checkWeighIn, isValidSleepHours, isValidSteps } from './entryChecks';

const history = [
  { date: '2026-09-01', weightKg: 90 },
  { date: '2026-09-28', weightKg: 85 },
  { date: '2026-10-02', weightKg: 85.2 },
];

describe('checkWeighIn', () => {
  it('refuses what can’t be a bodyweight', () => {
    for (const kg of [0, 8.5, 29.9, 300.1, 850, NaN, Infinity]) expect(checkWeighIn(kg, '2026-10-04', history).kind).toBe('invalid');
    expect(checkWeighIn(30, '2026-10-04', []).kind).toBe('ok');
    expect(checkWeighIn(300, '2026-10-04', []).kind).toBe('ok');
  });

  it('lets ordinary day-to-day swings through', () => {
    for (const kg of [83, 85, 86.5, 88]) expect(checkWeighIn(kg, '2026-10-04', history).kind).toBe('ok');
  });

  it('questions a slip of the finger, naming the reading it was compared with', () => {
    const c = checkWeighIn(58, '2026-10-04', history);
    expect(c.kind).toBe('unusual');
    if (c.kind !== 'unusual') return;
    expect(c.nearest.date).toBe('2026-10-02');
    expect(c.diffKg).toBeCloseTo(-27.2, 5);
    expect(checkWeighIn(95, '2026-10-04', history).kind).toBe('unusual');
  });

  it('allows more change the further apart the readings are', () => {
    // Nearest to 2026-09-14 is 09-01 or 09-28 (13/14 days): 90 → allowance 3 + 90*0.015*13/7 ≈ 5.5.
    expect(checkWeighIn(85, '2026-09-14', history).kind).toBe('ok');
    // With only a reading from eight weeks back, a 10 kg loss is plausible.
    expect(checkWeighIn(80, '2026-10-27', [{ date: '2026-09-01', weightKg: 90 }]).kind).toBe('ok');
    // The same 10 kg a day later is not.
    expect(checkWeighIn(80, '2026-09-02', [{ date: '2026-09-01', weightKg: 90 }]).kind).toBe('unusual');
  });

  it('looks at neighbours on both sides — backfilling sits between readings', () => {
    // 2026-09-30 is two days from both 09-28 and 10-02.
    expect(checkWeighIn(70, '2026-09-30', history).kind).toBe('unusual');
    expect(checkWeighIn(85.1, '2026-09-30', history).kind).toBe('ok');
  });

  it('ignores the reading on the same day, which this one replaces', () => {
    // Correcting a typo: the bad value already stored for the day mustn't be the comparison.
    const withTypo = [...history, { date: '2026-10-04', weightKg: 58 }];
    expect(checkWeighIn(85, '2026-10-04', withTypo).kind).toBe('ok');
  });

  it('has nothing to compare the first weigh-in with', () => {
    expect(checkWeighIn(120, '2026-10-04', []).kind).toBe('ok');
  });
});

describe('steps and sleep bounds', () => {
  it('steps are whole, non-negative and human', () => {
    expect([0, 8000, 100000].every(isValidSteps)).toBe(true);
    expect([-1, 100001, 8000.5, NaN].some(isValidSteps)).toBe(false);
  });
  it('sleep fits in a day', () => {
    expect([0, 7.5, 24].every(isValidSleepHours)).toBe(true);
    expect([-0.5, 24.5, 75, NaN].some(isValidSleepHours)).toBe(false);
  });
});
