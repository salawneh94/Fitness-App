import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { colors } from '@fittrack/shared';
import { hexToRgba } from '@/lib/color';

// These tiles sit two-up in a ~165pt column, so an icon beside the text left the label about
// 70pt to work with and "Calories Left Today" broke onto three lines. Stacking the icon above
// gives the label the full width. The tile also takes flex-1 so it fills the height its row
// stretches to — that, not a fixed label height, is what keeps a row of tiles even without
// reserving a phantom second line under every one-line label.
export default function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  accent = colors.series1,
  wide = false,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: string;
  /** Full-width tile — lays the icon out beside the text instead of above it. */
  wide?: boolean;
}) {
  const badge = (
    <View
      className="w-10 h-10 rounded-2xl items-center justify-center shrink-0"
      style={{ backgroundColor: hexToRgba(accent, 0.18) }}
    >
      <Icon color={accent} size={19} />
    </View>
  );

  const text = (
    <View className="flex-1 min-w-0">
      <Text
        numberOfLines={2}
        className="text-xs uppercase"
        style={{ color: colors.textMuted, letterSpacing: 0.6, lineHeight: 15 }}
      >
        {label}
      </Text>
      <Text
        className="text-2xl font-bold mt-1"
        style={{ color: colors.textPrimary, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
      {sub && (
        <Text
          numberOfLines={2}
          className="text-xs mt-1"
          style={{ color: colors.textSecondary, lineHeight: 15 }}
        >
          {sub}
        </Text>
      )}
    </View>
  );

  return (
    <View
      className={`rounded-3xl p-5 border ${wide ? 'flex-row items-center gap-4' : 'flex-1'}`}
      style={{ backgroundColor: colors.chartSurface, borderColor: colors.gridline }}
    >
      {wide ? (
        <>
          {badge}
          {text}
        </>
      ) : (
        <>
          <View className="mb-3">{badge}</View>
          {text}
        </>
      )}
    </View>
  );
}
