import { ChevronLeft, ChevronRight, Sparkles, Trophy } from 'lucide-react-native';
import { Text, View } from 'react-native';
import type { WeeklyRecap } from '@fittrack/shared';
import { colors, parseISODate } from '@fittrack/shared';
import Card from './ui/card';
import PressableScale from './ui/pressable-scale';

const shortDate = (iso: string) => parseISODate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * A week told back in a few sentences, leading with the best of it.
 *
 * Used twice: on Overview at the start of a week (with "Got it"), and on Progress with arrows to
 * page through earlier weeks.
 */
export default function RecapCard({
  recap,
  title,
  onDismiss,
  onPrev,
  onNext,
}: {
  recap: WeeklyRecap;
  title: string;
  onDismiss?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const range = `${shortDate(recap.weekStart)} – ${shortDate(recap.weekEnd)}`;
  return (
    <Card>
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-1 min-w-0">
          <Text className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textMuted }}>
            {title}
          </Text>
          <Text className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
            {range}
          </Text>
        </View>
        {(onPrev || onNext) && (
          <View className="flex-row items-center gap-1">
            <PressableScale
              hapticStyle="selection"
              accessibilityRole="button"
              accessibilityLabel="Previous week"
              disabled={!onPrev}
              onPress={onPrev}
              className="p-1.5"
              style={{ opacity: onPrev ? 1 : 0.3 }}
            >
              <ChevronLeft size={18} color={colors.textSecondary} />
            </PressableScale>
            <PressableScale
              hapticStyle="selection"
              accessibilityRole="button"
              accessibilityLabel="Next week"
              disabled={!onNext}
              onPress={onNext}
              className="p-1.5"
              style={{ opacity: onNext ? 1 : 0.3 }}
            >
              <ChevronRight size={18} color={colors.textSecondary} />
            </PressableScale>
          </View>
        )}
      </View>

      <View className="flex-row items-center gap-2 mb-3">
        {recap.records.length > 0 ? <Trophy size={18} color={colors.brandLime} /> : <Sparkles size={18} color={colors.brandPrimary} />}
        <Text className="text-lg font-bold flex-1" style={{ color: colors.textPrimary }} accessibilityRole="header">
          {recap.headline}
        </Text>
      </View>

      {recap.empty ? (
        <Text className="text-sm" style={{ color: colors.textMuted }}>
          Nothing was logged this week.
        </Text>
      ) : (
        <View className="gap-1.5">
          {recap.lines.map((line) => (
            <View key={line} className="flex-row gap-2">
              <Text style={{ color: colors.textMuted }}>•</Text>
              <Text className="text-sm flex-1" style={{ color: colors.textSecondary }}>
                {line}
              </Text>
            </View>
          ))}
        </View>
      )}

      {onDismiss && (
        <PressableScale hapticStyle="selection" accessibilityRole="button" onPress={onDismiss} className="self-start mt-4 py-1">
          <Text className="text-sm font-medium" style={{ color: colors.brandPrimary }}>
            Got it
          </Text>
        </PressableScale>
      )}
    </Card>
  );
}
