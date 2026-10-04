import { useMemo } from 'react';
import { Flag, Minus, TrendingDown, TrendingUp } from 'lucide-react-native';
import { Text, View } from 'react-native';
import type { GoalForecast, Profile, UnitSystem } from '@fittrack/shared';
import { colors, displayWeight, forecastGoal, parseISODate, planDailyTargets, todayISO, weightUnitLabel } from '@fittrack/shared';
import { useAppStore } from '@/store/useAppStore';
import { useAdaptiveTargets } from '@/hooks/use-adaptive-targets';

const kg = (v: number, unit: UnitSystem) => `${(Math.round(displayWeight(v, unit) * 10) / 10).toFixed(1)} ${weightUnitLabel(unit)}`;
const perWeek = (v: number, unit: UnitSystem) => `${displayWeight(Math.abs(v), unit).toFixed(2)} ${weightUnitLabel(unit)}/week`;

function when(f: GoalForecast): string {
  const date = parseISODate(f.etaDate!);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
  return `${label} — about ${f.etaWeeks} week${f.etaWeeks === 1 ? '' : 's'}`;
}

/**
 * The measured answer to "when will I get there?", under the weight chart.
 *
 * The plan's estimate is made once, from a formula, and never revisited. This one is redrawn from
 * the weigh-ins every day, so it says whether the plan is actually working — and if not, which
 * way it's off — rather than repeating the promise made at sign-up.
 */
export default function GoalForecastNote({ profile }: { profile: Profile }) {
  const weightHistory = useAppStore((s) => s.weightHistory);
  const { adaptive, measured } = useAdaptiveTargets(profile);
  const today = todayISO();
  const unit = profile.unitSystem;
  const target = profile.targetWeightKg;

  const forecast = useMemo(() => {
    const planned = planDailyTargets(profile, measured && 'tdee' in adaptive ? adaptive.tdee : undefined).appliedWeeklyRateKg;
    return forecastGoal(target, planned, weightHistory, today);
  }, [profile, target, weightHistory, today, adaptive, measured]);

  if (target == null) return null;

  let Icon = Flag;
  let headline: string;
  let detail: string;
  let tint: string = colors.brandPrimary;

  if (!forecast) {
    headline = `Forecast for ${kg(target, unit)}`;
    detail = 'Weigh in a few times a week. After two weeks of readings, this shows when you’ll reach your target at the pace you’re actually going.';
    tint = colors.textMuted;
  } else {
    const trend = `Trend ${kg(forecast.trendKg, unit)}`;
    const over = `over the last ${forecast.spanDays} days`;
    const plan = perWeek(forecast.plannedKgPerWeek, unit);
    const pace = perWeek(forecast.observedKgPerWeek, unit);
    const losing = forecast.observedKgPerWeek < 0;
    switch (forecast.status) {
      case 'reached':
        headline = `You’re at your ${kg(target, unit)} target`;
        detail = `${trend}, fitted through ${forecast.weighIns} weigh-ins — set a new target in Profile if you’re aiming further.`;
        tint = colors.statusGood;
        break;
      case 'on_track':
      case 'ahead':
      case 'behind':
        Icon = losing ? TrendingDown : TrendingUp;
        headline = forecast.etaDate ? `${kg(target, unit)} by ${when(forecast)}` : `${kg(target, unit)} is more than two years out at this pace`;
        detail =
          forecast.status === 'on_track'
            ? `${trend}, ${losing ? 'losing' : 'gaining'} ${pace} ${over} — right in line with your plan.`
            : forecast.status === 'ahead'
              ? `${trend}, ${losing ? 'losing' : 'gaining'} ${pace} ${over} — quicker than the ${plan} your plan aims for.`
              : `${trend}, ${losing ? 'losing' : 'gaining'} ${pace} ${over} — slower than the ${plan} your plan aims for.`;
        tint = forecast.status === 'behind' ? colors.statusWarning : colors.brandPrimary;
        break;
      case 'stalled':
        Icon = Minus;
        headline = 'Holding steady';
        detail = `${trend}, about level ${over}. Your plan aims for ${plan} toward ${kg(target, unit)}.`;
        tint = colors.statusWarning;
        break;
      case 'wrong_way':
        Icon = losing ? TrendingDown : TrendingUp;
        headline = `Heading away from ${kg(target, unit)}`;
        detail = `${trend}, ${losing ? 'down' : 'up'} ${pace} ${over}.`;
        tint = colors.statusWarning;
        break;
    }
  }

  return (
    <View className="mt-4 pt-4 border-t flex-row items-start gap-2" style={{ borderColor: colors.gridline }} accessibilityRole="summary">
      <Icon size={16} color={tint} style={{ marginTop: 2 }} />
      <View className="flex-1 min-w-0">
        <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
          {headline}
        </Text>
        <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
          {detail}
        </Text>
      </View>
    </View>
  );
}
