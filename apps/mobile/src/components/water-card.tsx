import { useMemo } from 'react';
import { Droplet, Minus } from 'lucide-react-native';
import { Text, View } from 'react-native';
import type { Profile } from '@fittrack/shared';
import { colors, formatWater, todayISO, waterQuickAddsMl, waterTargetMl } from '@fittrack/shared';
import { useAppStore } from '@/store/useAppStore';
import Card from '@/components/ui/card';
import PressableScale from '@/components/ui/pressable-scale';

/**
 * Today's water, logged a glass at a time.
 *
 * Water is the thing people log most often in a day, so the whole interaction is one tap: no
 * modal, no number pad. The minus button takes back one glass — for the double-tap, not for
 * bookkeeping — and the day's total is all that's stored.
 */
export default function WaterCard({ profile }: { profile: Profile }) {
  const waterHistory = useAppStore((s) => s.waterHistory);
  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const addWater = useAppStore((s) => s.addWater);

  const today = todayISO();
  const ml = waterHistory.find((w) => w.date === today)?.ml ?? 0;
  const trainedToday = useMemo(() => workoutLogs.some((l) => l.date === today), [workoutLogs, today]);
  const target = waterTargetMl(profile.sex, trainedToday);
  const [glass, bottle] = waterQuickAddsMl(profile.unitSystem);
  const pct = target > 0 ? Math.min(1, ml / target) : 0;
  const reached = ml >= target;

  return (
    <Card
      title="Water"
      action={
        <Text className="text-xs" style={{ color: colors.textMuted }} accessibilityLiveRegion="polite">
          {formatWater(ml, profile.unitSystem)} / {formatWater(target, profile.unitSystem)}
        </Text>
      }
    >
      <View
        className="h-2.5 rounded-full overflow-hidden mb-2"
        style={{ backgroundColor: colors.gridline }}
        accessibilityRole="progressbar"
        accessibilityLabel="Water today"
        accessibilityValue={{ min: 0, max: target, now: Math.min(ml, target) }}
      >
        <View className="h-full rounded-full" style={{ width: `${pct * 100}%`, backgroundColor: colors.brandPrimary }} />
      </View>
      <Text className="text-xs mb-4" style={{ color: colors.textMuted }}>
        {reached
          ? 'Goal reached for today.'
          : `${formatWater(target - ml, profile.unitSystem)} to go`}
        {trainedToday ? ' · includes extra for today’s workout' : ''}
      </Text>

      <View className="flex-row items-center gap-2">
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Remove ${formatWater(glass, profile.unitSystem)}`}
          hapticStyle="selection"
          disabled={ml === 0}
          onPress={() => addWater(-glass)}
          className="w-10 h-10 rounded-full border items-center justify-center"
          style={{ borderColor: colors.gridline, opacity: ml === 0 ? 0.4 : 1 }}
        >
          <Minus size={16} color={colors.textSecondary} />
        </PressableScale>
        {[
          { label: 'Glass', amount: glass },
          { label: 'Bottle', amount: bottle },
        ].map(({ label, amount }) => (
          <PressableScale
            key={label}
            accessibilityRole="button"
            accessibilityLabel={`Add a ${label.toLowerCase()}, ${formatWater(amount, profile.unitSystem)}`}
            hapticStyle="success"
            onPress={() => addWater(amount)}
            className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-full"
            style={{ backgroundColor: 'rgba(34,211,238,0.12)' }}
          >
            <Droplet size={14} color={colors.brandPrimary} />
            <Text numberOfLines={1} className="text-sm font-semibold" style={{ color: colors.brandPrimary }}>
              +{formatWater(amount, profile.unitSystem)}
            </Text>
          </PressableScale>
        ))}
      </View>
    </Card>
  );
}
