import type { Sex, UnitSystem } from './types';

const ML_PER_FL_OZ = 29.5735;

/**
 * How much to drink in a day, in ml.
 *
 * Starts from EFSA's adequate intake for *total* water — 2.5 L for men, 2.0 L for women — and
 * takes 80% of it, because roughly a fifth of daily water arrives in food. Counting the full
 * figure as a drinking target would have people chasing half a litre they've already had.
 * A training day adds 500 ml for sweat loss. Rounded to 250 ml, since nobody drinks to the ml.
 *
 * Deliberately not "35 ml per kg": that heuristic estimates total water too, so it overshoots a
 * drinks-only target, and it scales without limit — a 120 kg user would be told to drink 4.2 L.
 */
export function waterTargetMl(sex: Sex, trainedToday: boolean): number {
  const totalWaterMl = sex === 'male' ? 2500 : sex === 'female' ? 2000 : 2250;
  const fromDrinks = totalWaterMl * 0.8 + (trainedToday ? 500 : 0);
  return Math.round(fromDrinks / 250) * 250;
}

/** The quick-add buttons: a glass and a bottle, in sizes people actually own. */
export function waterQuickAddsMl(unit: UnitSystem): number[] {
  // 8 fl oz cup and a 16.9 fl oz (500 ml) bottle — the US bottled-water standard size.
  return unit === 'imperial' ? [Math.round(8 * ML_PER_FL_OZ), 500] : [250, 500];
}

export function formatWater(ml: number, unit: UnitSystem): string {
  if (unit === 'imperial') return `${Math.round(ml / ML_PER_FL_OZ)} fl oz`;
  // Two decimals at most, trailing zeros dropped: water moves in 250 ml steps, so one decimal
  // would show 1250 ml as "1.3 L".
  return ml >= 1000 ? `${Math.round(ml / 10) / 100} L` : `${Math.round(ml)} ml`;
}
