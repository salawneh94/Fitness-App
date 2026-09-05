import { useMemo } from 'react';
import {
  calcDailyTargets,
  estimateAdaptiveTDEE,
  isAdaptiveTDEE,
  todayISO,
  type AdaptiveTDEEResult,
  type AdaptiveTDEEUnavailable,
  type DailyTargets,
  type Profile,
} from '@fittrack/shared';
import { useAppStore } from '@/store/useAppStore';

export interface AdaptiveTargets {
  targets: DailyTargets;
  /** The measurement, when there was enough history — otherwise why there wasn't. */
  adaptive: AdaptiveTDEEResult | AdaptiveTDEEUnavailable;
  /** True when `targets` came from the user's own data rather than the formula. */
  measured: boolean;
}

/**
 * The one place daily targets are computed, so every screen shows the same number.
 *
 * Targets used to be `calcDailyTargets(profile)` in four separate places. Once the calorie number
 * can come from measured data rather than a formula, four independent call sites would be four
 * chances to show a different figure on a different tab.
 */
export function useAdaptiveTargets(profile: Profile): AdaptiveTargets {
  const foodEntries = useAppStore((s) => s.foodEntries);
  const weightHistory = useAppStore((s) => s.weightHistory);
  const today = todayISO();

  // Both of these walk the user's entire history, so they're memoized on the raw collections —
  // by the time someone has a year of logs, foodEntries alone is thousands of rows.
  const intakeByDate = useMemo(() => {
    const totals = new Map<string, number>();
    for (const f of foodEntries) {
      totals.set(f.date, (totals.get(f.date) ?? 0) + f.calories * f.quantity);
    }
    return Array.from(totals, ([date, calories]) => ({ date, calories }));
  }, [foodEntries]);

  return useMemo(() => {
    const adaptive = estimateAdaptiveTDEE(profile, weightHistory, intakeByDate, today);
    const measured = isAdaptiveTDEE(adaptive);
    return {
      adaptive,
      measured,
      targets: calcDailyTargets(profile, measured ? adaptive.tdee : undefined),
    };
  }, [profile, weightHistory, intakeByDate, today]);
}
