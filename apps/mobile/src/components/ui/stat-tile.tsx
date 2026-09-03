import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { colors } from '@fittrack/shared';
import { hexToRgba } from '@/lib/color';

export default function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  accent = colors.series1,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: string;
}) {
  return (
    <View
      className="rounded-3xl p-5 flex-row items-start gap-4 border"
      style={{ backgroundColor: colors.chartSurface, borderColor: colors.gridline }}
    >
      <View
        className="w-11 h-11 rounded-2xl items-center justify-center shrink-0"
        style={{ backgroundColor: hexToRgba(accent, 0.18) }}
      >
        <Icon color={accent} size={20} />
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
          {label}
        </Text>
        <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
          {value}
        </Text>
        {sub && (
          <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
            {sub}
          </Text>
        )}
      </View>
    </View>
  );
}
