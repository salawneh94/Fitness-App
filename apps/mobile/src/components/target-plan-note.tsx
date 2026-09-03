import { AlertTriangle, TrendingDown, TrendingUp, Minus } from 'lucide-react-native';
import { View, Text } from 'react-native';
import type { Profile, TargetPlan } from '@fittrack/shared';
import { displayWeight, weightUnitLabel, colors } from '@fittrack/shared';

export default function TargetPlanNote({ profile, plan }: { profile: Profile; plan: TargetPlan }) {
  const unit = profile.unitSystem;
  const label = weightUnitLabel(unit);

  const rate = displayWeight(Math.abs(plan.appliedWeeklyRateKg), unit);
  const rateText = `${rate.toFixed(2)} ${label}/week`;
  const losing = plan.appliedWeeklyRateKg < -0.001;
  const gaining = plan.appliedWeeklyRateKg > 0.001;

  const Icon = losing ? TrendingDown : gaining ? TrendingUp : Minus;

  let headline: string;
  if (losing) headline = `Losing about ${rateText}`;
  else if (gaining) headline = `Gaining about ${rateText}`;
  else headline = 'Holding your current weight';

  const targetText =
    profile.targetWeightKg != null ? `${displayWeight(profile.targetWeightKg, unit).toFixed(1)} ${label}` : null;

  let detail: string | null = null;
  if (plan.projectedWeeks != null && targetText) {
    detail = `Reaching ${targetText} in about ${plan.projectedWeeks} week${plan.projectedWeeks === 1 ? '' : 's'}.`;
  }

  let warning: string | null = null;
  if (plan.hitCalorieFloor) {
    warning =
      'Your timeframe would require eating less than is safe, so calories are held at a healthy minimum and the timeline is stretched instead.';
  } else if (plan.rateWasCapped) {
    const requested = displayWeight(Math.abs(plan.requestedWeeklyRateKg), unit).toFixed(2);
    warning = `That timeframe asks for ${requested} ${label}/week, which is faster than is safe to sustain. The plan uses ${rateText} instead — adjust your timeframe to match.`;
  }

  return (
    <View className="mt-4 pt-4 border-t" style={{ borderColor: colors.gridline }}>
      <View className="flex-row items-start gap-2">
        <Icon size={16} color={colors.brandPrimary} style={{ marginTop: 2 }} />
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
            {headline}
          </Text>
          {detail && (
            <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
              {detail}
            </Text>
          )}
          <Text className="text-xs mt-1" style={{ color: colors.textMuted }}>
            Maintenance is about {plan.tdee} kcal/day for your body and activity level.
          </Text>
        </View>
      </View>

      {warning && (
        <View
          className="flex-row items-start gap-2 mt-3 p-2.5 rounded-xl border"
          style={{ backgroundColor: 'rgba(251, 191, 36, 0.08)', borderColor: 'rgba(251, 191, 36, 0.3)' }}
        >
          <AlertTriangle size={14} color={colors.statusWarning} style={{ marginTop: 2 }} />
          <Text className="text-xs flex-1" style={{ color: colors.textSecondary }}>
            {warning}
          </Text>
        </View>
      )}
    </View>
  );
}
