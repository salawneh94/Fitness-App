import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@fittrack/shared';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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

  // The arc sweeps to its value rather than snapping there. strokeDashoffset isn't a transform,
  // so this can't use the native driver — but it's one value over one animation, which the JS
  // thread handles without trouble.
  const animatedOffset = useRef(new Animated.Value(circumference)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) return;
      if (reduceMotion) {
        animatedOffset.setValue(offset);
        return;
      }
      Animated.timing(animatedOffset, {
        toValue: offset,
        duration: 900,
        useNativeDriver: false,
      }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [offset, animatedOffset]);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.gridline} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? overColor : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={animatedOffset}
        />
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Text className="text-2xl font-bold" maxFontSizeMultiplier={1.3} style={{ color: colors.textPrimary }}>
          {centerValue}
        </Text>
        <Text className="text-xs text-center px-2" maxFontSizeMultiplier={1.3} style={{ color: colors.textMuted }}>
          {centerLabel}
        </Text>
      </View>
    </View>
  );
}
