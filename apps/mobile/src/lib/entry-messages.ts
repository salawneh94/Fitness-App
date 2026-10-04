import type { UnitSystem, WeighInCheck } from '@fittrack/shared';
import { WEIGHT_RANGE_KG, displayWeight, parseISODate, weightUnitLabel } from '@fittrack/shared';

const fmt = (kg: number, unit: UnitSystem) => `${Math.round(displayWeight(kg, unit) * 10) / 10} ${weightUnitLabel(unit)}`;

/** What to tell the user about a weigh-in check, or null when there's nothing to say. Shared by
 * every place a weight is typed so the wording — and the thresholds behind it — can't drift. */
export function weighInMessage(check: WeighInCheck, unit: UnitSystem): string | null {
  if (check.kind === 'ok') return null;
  if (check.kind === 'invalid') {
    const lo = Math.round(displayWeight(WEIGHT_RANGE_KG.min, unit));
    const hi = Math.round(displayWeight(WEIGHT_RANGE_KG.max, unit));
    return `Weight should be between ${lo} and ${hi} ${weightUnitLabel(unit)}.`;
  }
  const day = parseISODate(check.nearest.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const diff = Math.abs(check.diffKg);
  return `That’s ${fmt(diff, unit)} ${check.diffKg > 0 ? 'more' : 'less'} than on ${day} (${fmt(check.nearest.weightKg, unit)}). Check it — or save anyway if it’s right.`;
}
