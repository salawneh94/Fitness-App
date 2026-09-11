import { useMemo } from 'react';
import { AlertTriangle, Lightbulb, Text as TextIcon, Trophy } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { colors, deriveInsights, todayISO, type Insight, type InsightTone } from '@fittrack/shared';
import { useAppStore } from '@/store/useAppStore';
import { useAdaptiveTargets } from '@/hooks/use-adaptive-targets';
import Card from './ui/card';

const TONE = {
  warning: { icon: AlertTriangle, color: colors.statusCritical, tint: 'rgba(248,113,113,0.10)' },
  suggestion: { icon: Lightbulb, color: colors.brandPrimary, tint: 'rgba(34,211,238,0.08)' },
  win: { icon: Trophy, color: colors.brandLime, tint: 'rgba(163,230,53,0.08)' },
} satisfies Record<InsightTone, { icon: typeof TextIcon; color: string; tint: string }>;

function InsightRow({ insight }: { insight: Insight }) {
  const { icon: Icon, color, tint } = TONE[insight.tone];
  return (
    <View className="flex-row items-start gap-3 p-3.5 rounded-2xl" style={{ backgroundColor: tint }}>
      <Icon size={18} color={color} style={{ marginTop: 2 }} />
      <View className="flex-1">
        <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
          {insight.title}
        </Text>
        <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
          {insight.detail}
        </Text>
      </View>
    </View>
  );
}

/**
 * The coach layer: what the app noticed, rather than what the user typed.
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
  const { adaptive, measured } = useAdaptiveTargets(profile!);

  const insights = useMemo(() => {
    if (!profile) return [];
    return deriveInsights({
      profile,
      foodEntries,
      workoutLogs,
      weights: weightHistory,
      sleep: sleepHistory,
      today: todayISO(),
      // Pass the same maintenance figure the targets on screen were built from, so an insight
      // can never argue with the number it's commenting on.
      measuredTDEE: measured && 'tdee' in adaptive ? adaptive.tdee : undefined,
    });
  }, [profile, foodEntries, workoutLogs, weightHistory, sleepHistory, adaptive, measured]);

  if (!profile || insights.length === 0) return null;

  const shown = limit ? insights.slice(0, limit) : insights;

  return (
    <Card title={title}>
      <View className="gap-2.5">
        {shown.map((insight) => (
          <InsightRow key={insight.id} insight={insight} />
        ))}
      </View>
    </Card>
  );
}
