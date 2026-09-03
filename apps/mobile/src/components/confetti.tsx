import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

const COLORS = ['#22d3ee', '#fbbf24', '#3987e5', '#1baf7a', '#eb6834'];
const FALL_DISTANCE = 400;

interface Piece {
  left: number;
  color: string;
  delay: number;
  duration: number;
}

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, () => ({
    left: Math.random() * 100,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: Math.random() * 300,
    duration: 1600 + Math.random() * 800,
  }));
}

function ConfettiPiece({ piece }: { piece: Piece }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: piece.duration,
      delay: piece.delay,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-10, FALL_DISTANCE] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const opacity = progress.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: `${piece.left}%`,
        top: 0,
        width: 8,
        height: 12,
        borderRadius: 2,
        backgroundColor: piece.color,
        opacity,
        transform: [{ translateY }, { rotate }],
      }}
    />
  );
}

/** A brief confetti burst for celebratory moments — mount it, let it play once, unmount it. */
export default function Confetti({ count = 36 }: { count?: number }) {
  const pieces = useRef(makePieces(count)).current;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => (
        <ConfettiPiece key={i} piece={p} />
      ))}
    </View>
  );
}
