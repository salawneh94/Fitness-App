import { useRef } from 'react';
import { Animated, Pressable, type PressableProps } from 'react-native';
import { cssInterop } from 'nativewind';
import { haptic, type HapticStyle } from '@/lib/haptics';

// Animating the Pressable itself (rather than wrapping it in an Animated.View) keeps layout
// identical to a plain Pressable — a wrapper would swallow flex-1 and similar classes from the
// call site. cssInterop is what teaches NativeWind to keep handling className on it.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
cssInterop(AnimatedPressable, { className: 'style' });

interface PressableScaleProps extends PressableProps {
  /** How far to scale down while held. */
  scaleTo?: number;
  /** Haptic fired on press; pass 'none' for repeated//incidental taps that shouldn't buzz. */
  hapticStyle?: HapticStyle;
  className?: string;
}

/**
 * A Pressable that springs down under the finger and fires a haptic — the tactile half of what
 * makes a native app feel responsive rather than like a web page in a shell. Drop-in
 * replacement for Pressable; all the usual props pass through.
 */
export default function PressableScale({
  scaleTo = 0.97,
  hapticStyle = 'light',
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  style,
  ...rest
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true, // transform:scale runs on the UI thread, so this stays smooth
      speed: 50,
      bounciness: 0,
    }).start();

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) spring(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        spring(1);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (!disabled) haptic(hapticStyle);
        onPress?.(e);
      }}
      style={[{ transform: [{ scale }] }, style as object]}
      {...rest}
    />
  );
}
