import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { AlertTriangle, CalendarCheck, Lightbulb, Text as TextIcon, Trophy } from 'lucide-react-native';
import { Text, View } from 'react-native';
import {
  colors,
  deriveInsights,
  displayWeight,
  isDeloadActive,
  todayISO,
  weightUnitLabel,
  withoutSnoozed,
  type Insight,
  type InsightTone,
  type MealType,
  type UnitSystem,
} from '@fittrack/shared';
import { useAppStore } from '@/store/useAppStore';
import { useAdaptiveTargets } from '@/hooks/use-adaptive-targets';
import AddFoodModal from './add-food-modal';
import Card from './ui/card';
import PressableScale from './ui/pressable-scale';

const TONE = {
  warning: { icon: AlertTriangle, color: colors.statusCritical, tint: 'rgba(248,113,113,0.10)' },
  suggestion: { icon: Lightbulb, color: colors.brandPrimary, tint: 'rgba(34,211,238,0.08)' },
  win: { icon: Trophy, color: colors.brandLime, tint: 'rgba(163,230,53,0.08)' },
} satisfies Record<InsightTone, { icon: typeof TextIcon; color: string; tint: string }>;

/** The meal someone is most likely about to eat, for opening the food sheet from outside a meal card. */
function mealForNow(date = new Date()): MealType {
  const h = date.getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

function InsightRow({
  insight,
  unit,
  onProteinFoods,
}: {
  insight: Insight;
  unit: UnitSystem;
  onProteinFoods: () => void;
}) {
  const { icon: Icon, color, tint } = TONE[insight.tone];
  const router = useRouter();
  const deloads = useAppStore((s) => s.deloads);
  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const startDeload = useAppStore((s) => s.startDeload);
  const cancelDeload = useAppStore((s) => s.cancelDeload);
  const snoozeInsight = useAppStore((s) => s.snoozeInsight);

  const action = insight.action;
  // Planned already? Then the row confirms the plan instead of offering it again.
  const planned =
    action?.kind === 'deload'
      ? deloads.find((d) => d.exerciseId === action.exerciseId && d.stalledKg === action.stalledKg && isDeloadActive(d, workoutLogs))
      : undefined;

  return (
    <View className="p-3.5 rounded-2xl" style={{ backgroundColor: tint }}>
      <View className="flex-row items-start gap-3">
        <Icon size={18} color={color} style={{ marginTop: 2 }} />
        <View className="flex-1">
          <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
            {insight.title}
          </Text>
          <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
            {insight.detail}
          </Text>

          {planned ? (
            <View className="flex-row items-center gap-2 mt-3 flex-wrap">
              <CalendarCheck size={14} color={colors.brandLime} />
              <Text className="text-xs font-medium" style={{ color: colors.brandLime }}>
                Planned: {Math.round(displayWeight(planned.deloadKg, unit) * 10) / 10} {weightUnitLabel(unit)} next session
              </Text>
              <PressableScale hapticStyle="selection" accessibilityRole="button" onPress={() => cancelDeload(planned.exerciseId)}>
                <Text className="text-xs underline" style={{ color: colors.textMuted }}>
                  Undo
                </Text>
              </PressableScale>
            </View>
          ) : (
            <View className="flex-row items-center gap-3 mt-3 flex-wrap">
              {action && (
                <PressableScale
                  hapticStyle="success"
                  accessibilityRole="button"
                  onPress={() => {
                    if (action.kind === 'deload') {
                      startDeload({ exerciseId: action.exerciseId, stalledKg: action.stalledKg, deloadKg: action.deloadKg });
                    } else if (action.kind === 'protein_foods') {
                      onProteinFoods();
                    } else {
                      router.push('/plans');
                    }
                  }}
                  className="px-3.5 py-2 rounded-full"
                  style={{ backgroundColor: colors.brandPrimaryDark }}
                >
                  <Text className="text-xs font-semibold text-white">{action.label}</Text>
                </PressableScale>
              )}
              {/* A card that says the same thing every time the app opens stops being read — and
                  then isn't read on the day it says something new. */}
              <PressableScale
                hapticStyle="selection"
                accessibilityRole="button"
                accessibilityLabel={`Not now: ${insight.title}`}
                onPress={() => snoozeInsight(insight.key)}
                className="py-2"
              >
                <Text className="text-xs" style={{ color: colors.textMuted }}>
                  Not now
                </Text>
              </PressableScale>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * The coach layer: what the app noticed, rather than what the user typed — and, where there's a
 * one-tap way to act on it, the button to do so.
 *
 * Renders nothing when there's nothing worth saying — an empty "no insights yet" card would be
 * a standing reminder that a feature isn't working. deriveInsights is deliberately silent below
 * its evidence thresholds, and this respects that.
 */
export default function InsightsCard({ title = 'What we noticed', limit }: { title?: string; limit?: number }) {
  const profile = useAppStore((s) => s.profile);
  const foodEntries = useAppStore((s) => s.foodEntries);
  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const weightHistory = useAppStore((s) => s.weightHistory);
  const sleepHistory = useAppStore((s) => s.sleepHistory);
  const insightSnoozes = useAppStore((s) => s.insightSnoozes);
  const { adaptive, measured } = useAdaptiveTargets(profile!);
  const [foodSheet, setFoodSheet] = useState<MealType | null>(null);

  const insights = useMemo(() => {
    if (!profile) return [];
    const today = todayISO();
    const all = deriveInsights({
      profile,
      foodEntries,
      workoutLogs,
      weights: weightHistory,
      sleep: sleepHistory,
      today,
      // Pass the same maintenance figure the targets on screen were built from, so an insight
      // can never argue with the number it's commenting on.
      measuredTDEE: measured && 'tdee' in adaptive ? adaptive.tdee : undefined,
    });
    return withoutSnoozed(all, insightSnoozes, today);
  }, [profile, foodEntries, workoutLogs, weightHistory, sleepHistory, adaptive, measured, insightSnoozes]);

  if (!profile || insights.length === 0) return null;

  const shown = limit ? insights.slice(0, limit) : insights;

  return (
    <>
      <Card title={title}>
        <View className="gap-2.5">
          {shown.map((insight) => (
            <InsightRow
              key={insight.key}
              insight={insight}
              unit={profile.unitSystem}
              onProteinFoods={() => setFoodSheet(mealForNow())}
            />
          ))}
        </View>
      </Card>
      {foodSheet && <AddFoodModal meal={foodSheet} highlight="protein" onClose={() => setFoodSheet(null)} />}
    </>
  );
}
