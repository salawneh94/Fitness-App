import { describe, expect, it } from 'vitest';
import { forecastGoal } from './forecast';
import { addDaysISO } from './calc';

const TODAY = '2026-10-04';

/** A weigh-in every other day for four weeks, on a straight line, with optional day-to-day noise. */
function series(startKg: number, kgPerWeek: number, noise: number[] = []): { date: string; weightKg: number }[] {
  const out = [];
  for (let i = 0; i <= 14; i++) {
    const back = 28 - i * 2;
    out.push({ date: addDaysISO(TODAY, -back), weightKg: startKg + (kgPerWeek / 7) * (i * 2) + (noise[i % noise.length] ?? 0) });
  }
  return out;
}

describe('forecastGoal', () => {
  it('needs a target', () => {
    expect(forecastGoal(null, -0.5, series(90, -0.5), TODAY)).toBeNull();
    expect(forecastGoal(undefined, -0.5, series(90, -0.5), TODAY)).toBeNull();
  });

  it('stays quiet without enough weigh-ins or span', () => {
    expect(forecastGoal(80, -0.5, series(90, -0.5).slice(-7), TODAY)).toBeNull(); // 7 readings
    const tight = Array.from({ length: 10 }, (_, i) => ({ date: addDaysISO(TODAY, -i), weightKg: 90 - i * 0.05 })); // 9-day span
    expect(forecastGoal(80, -0.5, tight, TODAY)).toBeNull();
  });

  it('ignores weigh-ins outside the four-week window and in the future', () => {
    const old = Array.from({ length: 20 }, (_, i) => ({ date: addDaysISO(TODAY, -60 - i), weightKg: 100 }));
    expect(forecastGoal(80, -0.5, old, TODAY)).toBeNull();
    const withFuture = [...series(90, -0.5), { date: addDaysISO(TODAY, 3), weightKg: 50 }];
    expect(forecastGoal(80, -0.5, withFuture, TODAY)!.observedKgPerWeek).toBeCloseTo(-0.5, 5);
  });

  it('extends the fitted line to the target', () => {
    // 90 → 88 over four weeks: trend today is 88, 8 kg to go at 0.5 kg/week = 16 weeks.
    const f = forecastGoal(80, -0.5, series(90, -0.5), TODAY)!;
    expect(f.status).toBe('on_track');
    expect(f.trendKg).toBeCloseTo(88, 5);
    expect(f.remainingKg).toBeCloseTo(-8, 5);
    expect(f.etaWeeks).toBe(16);
    expect(f.etaDate).toBe(addDaysISO(TODAY, 112));
    expect(f.weighIns).toBe(15);
    expect(f.spanDays).toBe(28);
  });

  it('is not thrown by one heavy morning', () => {
    const noisy = series(90, -0.5);
    noisy[noisy.length - 1] = { ...noisy[noisy.length - 1], weightKg: noisy[noisy.length - 1].weightKg + 1.5 }; // salty dinner
    const f = forecastGoal(80, -0.5, noisy, TODAY)!;
    expect(f.status).toBe('on_track');
    expect(f.etaWeeks).toBe(16);
    expect(f.trendKg).toBeCloseTo(88, 5);
  });

  it('works for gaining too', () => {
    const f = forecastGoal(80, 0.25, series(75, 0.25), TODAY)!;
    expect(f.status).toBe('on_track');
    expect(f.remainingKg).toBeCloseTo(4, 5);
    expect(f.etaWeeks).toBe(16);
  });

  it('compares pace with the plan', () => {
    expect(forecastGoal(70, -0.5, series(90, -0.8), TODAY)!.status).toBe('ahead');
    expect(forecastGoal(70, -0.5, series(90, -0.3), TODAY)!.status).toBe('behind');
    expect(forecastGoal(70, -0.5, series(90, -0.45), TODAY)!.status).toBe('on_track');
  });

  it('has no pace to compare against when the plan holds weight', () => {
    expect(forecastGoal(70, 0, series(90, -0.8), TODAY)!.status).toBe('on_track');
  });

  it('calls a flat trend stalled, with no date', () => {
    const f = forecastGoal(80, -0.5, series(88, 0, [0.3, -0.2, 0.1, -0.3]), TODAY)!;
    expect(f.status).toBe('stalled');
    expect(f.etaWeeks).toBeNull();
    expect(f.etaDate).toBeNull();
  });

  it('says so when the trend is heading away from the target', () => {
    const f = forecastGoal(80, -0.5, series(88, 0.4), TODAY)!;
    expect(f.status).toBe('wrong_way');
    expect(f.etaWeeks).toBeNull();
  });

  it('calls it reached within half a kilo, whichever way the trend is going', () => {
    expect(forecastGoal(80.3, -0.5, series(82, -0.5), TODAY)!.status).toBe('reached');
    expect(forecastGoal(79.7, -0.5, series(80, 0), TODAY)!.status).toBe('reached');
  });

  it('declines to give a date more than two years out', () => {
    // 40 kg to go at 0.15 kg/week is over five years.
    const f = forecastGoal(50, -0.5, series(90.6, -0.15), TODAY)!;
    expect(f.status).toBe('behind');
    expect(f.etaWeeks).toBeNull();
    expect(f.etaDate).toBeNull();
  });

  it('never forecasts "0 weeks"', () => {
    // 0.6 kg to go at 1 kg/week rounds to 1, not 0.
    expect(forecastGoal(87.4, -1, series(92, -1), TODAY)!.etaWeeks).toBe(1);
  });
});

describe('forecastGoal robustness', () => {
  const base = series(90, -0.5);
  it.each([0.5, 1, 1.5, -1.5])('one %s kg reading on the newest day leaves the date where it was', (spike) => {
    const n = base.map((p, i) => (i === base.length - 1 ? { ...p, weightKg: p.weightKg + spike } : p));
    const f = forecastGoal(80, -0.5, n, TODAY)!;
    expect(f.status).toBe('on_track');
    expect(f.etaWeeks).toBe(16);
  });
});
