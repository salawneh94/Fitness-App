import { Activity, TrendingDown, TrendingUp } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { colors, isAdaptiveTDEE, type UnitSystem } from '@fittrack/shared';
import { displayWeight, weightUnitLabel } from '@fittrack/shared';
import Card from './ui/card';
import type { AdaptiveTargets } from '@/hooks/use-adaptive-targets';

const NEEDED: Record<string, (shortfall: number) => string> = {
  not_enough_weigh_ins: (n) => `${n} more weigh-in${n === 1 ? '' : 's'}`,
  span_too_short: (n) => `${n} more day${n === 1 ? '' : 's'} between your first and last weigh-in`,
  not_enough_intake_days: (n) => `${n} more day${n === 1 ? '' : 's'} of food logging`,
  intake_coverage_too_low: (n) => `${n} more logged day${n === 1 ? '' : 's'} to fill the gaps`,
};

/**
 * Explains where the calorie target came from.
 *
 * A number that silently changes is worse than one that never moves — the user has no way to
 * tell an improvement from a bug, and no reason to trust it. So this says what was measured,
 * what it was measured from, and how it compares to the textbook estimate it replaced.
 *
 * It's equally deliberate that the pre-measurement state is shown rather than hidden: "keep
 * logging and this gets personal" is the whole argument for logging consistently, and it only
 * lands if the user can see the progress bar toward it.
 */
export default function AdaptiveTargetCard({
  state,
  unitSystem,
}: {
  state: AdaptiveTargets;
  unitSystem: UnitSystem;
}) {
  const { adaptive } = state;

  if (!isAdaptiveTDEE(adaptive)) {
    const needed = NEEDED[adaptive.reason]?.(adaptive.shortfall);
    return (
      <Card title="Your calorie target">
        <View className="flex-row items-start gap-3">
          <Activity size={18} color={colors.textMuted} style={{ marginTop: 2 }} />
          <View className="flex-1">
            <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
              Based on a standard formula for now
            </Text>
            <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
              {needed
                ? `Log ${needed} and FitTrack will replace this estimate with your own measured maintenance calories.`
                : 'Keep logging your weight and meals and FitTrack will measure your real maintenance calories.'}
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  const weekly = adaptive.observedWeeklyChangeKg;
  const losing = weekly < -0.05;
  const gaining = weekly > 0.05;
  const Icon = losing ? TrendingDown : gaining ? TrendingUp : Activity;
  const rate = Math.abs(displayWeight(weekly, unitSystem)).toFixed(2);
  const unit = weightUnitLabel(unitSystem);

  const difference = adaptive.tdee - adaptive.formulaTdee;
  const magnitude = Math.abs(difference);

  return (
    <Card title="Your calorie target">
      <View className="flex-row items-start gap-3">
        <Icon size={18} color={colors.brandPrimary} style={{ marginTop: 2 }} />
        <View className="flex-1">
          <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
            Measured from your own data
          </Text>
          <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
            {/* spanDays is the gap between first and last weigh-in; +1 is the number of calendar
                days actually covered, which is what "25 logged days" below counts. */}
            Over the last {adaptive.spanDays + 1} days you averaged {adaptive.meanIntake.toLocaleString()} kcal
            a day and {losing ? `lost about ${rate} ${unit}` : gaining ? `gained about ${rate} ${unit}` : 'held steady'}
            {losing || gaining ? ' a week' : ''}. That puts your maintenance at about{' '}
            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
              {adaptive.tdee.toLocaleString()} kcal
            </Text>
            {magnitude >= 25
              ? ` — ${magnitude.toLocaleString()} ${difference > 0 ? 'higher' : 'lower'} than the standard formula predicted.`
              : ', which matches the standard formula closely.'}
          </Text>

          {adaptive.clamped && (
            <Text className="text-xs mt-2" style={{ color: colors.statusCritical }}>
              Your logs point even further from the formula than that, which usually means some
              days are missing or a weigh-in is off. The target is held partway until the numbers
              settle.
            </Text>
          )}

          <Text className="text-xs mt-2" style={{ color: colors.textMuted }}>
            From {adaptive.weighIns} weigh-ins and {adaptive.intakeDays} logged days. Updates as you log.
          </Text>
        </View>
      </View>
    </Card>
  );
}
