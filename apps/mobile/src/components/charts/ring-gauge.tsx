import type { ReactNode } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@fittrack/shared';

export default function RingGauge({
  value,
  target,
  color = colors.brandPrimary,
  overColor = colors.statusWarning,
  size = 160,
  stroke = 14,
  centerValue,
  centerLabel,
  allowOverTarget = true,
}: {
  value: number;
  target: number;
  color?: string;
  overColor?: string;
  size?: number;
  stroke?: number;
  centerValue: ReactNode;
  centerLabel: string;
  allowOverTarget?: boolean;
}) {
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  const over = allowOverTarget && value > target;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.gridline} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? overColor : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
          {centerValue}
        </Text>
        <Text className="text-xs text-center px-2" style={{ color: colors.textMuted }}>
          {centerLabel}
        </Text>
      </View>
    </View>
  );
}
