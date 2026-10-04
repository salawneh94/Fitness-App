import type { WeightEntry } from './types';
import { daysBetween } from './trend';

/** Same bounds onboarding accepts — a weight outside them is a typo, not a reading. */
export const WEIGHT_RANGE_KG = { min: 30, max: 300 } as const;
export const MAX_DAILY_STEPS = 100_000;
export const MAX_SLEEP_HOURS = 24;

/**
 * How far a reading may sit from its nearest neighbour before it's worth a second look.
 *
 * Day to day, water and glycogen move bodyweight by up to two or three kilos, so the base allowance
 * covers that. On top of it, 1.5% of bodyweight per week apart — half again the fastest loss the
 * plans allow — so genuine fast change over a few weeks still goes through without a question.
 * What it catches is the slip of a finger: 58 for 85, 95 for 85, 8.5 for 85.
 */
const BASE_ALLOWANCE_KG = 3;
const WEEKLY_ALLOWANCE_FRACTION = 0.015;

export type WeighInCheck =
  | { kind: 'ok' }
  /** Can't be right — refuse it. */
  | { kind: 'invalid' }
  /** Could be right, but probably isn't — ask before saving. */
  | { kind: 'unusual'; nearest: WeightEntry; diffKg: number };

/**
 * Sanity-check a weigh-in before it's saved.
 *
 * It matters more than it looks: the newest weigh-in becomes "your weight", which every calorie
 * target, the forecast and the measured maintenance are computed from. One stray 850 used to set
 * all of them at once, and stay.
 */
export function checkWeighIn(weightKg: number, date: string, history: WeightEntry[]): WeighInCheck {
  if (!Number.isFinite(weightKg) || weightKg < WEIGHT_RANGE_KG.min || weightKg > WEIGHT_RANGE_KG.max) return { kind: 'invalid' };

  // The closest reading in time, on either side — not the same day, which this one replaces.
  let nearest: WeightEntry | undefined;
  let nearestGap = Infinity;
  for (const w of history) {
    if (w.date === date || !(w.weightKg > 0)) continue;
    const gap = Math.abs(daysBetween(w.date, date));
    if (gap < nearestGap) {
      nearest = w;
      nearestGap = gap;
    }
  }
  if (!nearest) return { kind: 'ok' };

  const allowance = BASE_ALLOWANCE_KG + nearest.weightKg * WEEKLY_ALLOWANCE_FRACTION * (nearestGap / 7);
  const diffKg = weightKg - nearest.weightKg;
  return Math.abs(diffKg) > allowance ? { kind: 'unusual', nearest, diffKg } : { kind: 'ok' };
}

/** Steps and sleep only need bounds: there's no trend built on them for a typo to poison. */
export function isValidSteps(steps: number): boolean {
  return Number.isInteger(steps) && steps >= 0 && steps <= MAX_DAILY_STEPS;
}

export function isValidSleepHours(hours: number): boolean {
  return Number.isFinite(hours) && hours >= 0 && hours <= MAX_SLEEP_HOURS;
}
