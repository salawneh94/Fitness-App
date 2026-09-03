import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';

const TAGLINES = [
  'Every rep counts. Keep pushing.',
  "You didn't come this far to only come this far.",
  'Discipline beats motivation on the hard days.',
  'Small wins today, big changes over time.',
  'Show up. That’s the whole secret.',
  'Your only competition is who you were yesterday.',
  'Strong body, stronger mind.',
  'Consistency is the real superpower.',
];

export default function MotivationalTagline() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * TAGLINES.length));
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    function scheduleNext() {
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          if (cancelled) return;
          setIndex((i) => (i + 1) % TAGLINES.length);
          Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
          scheduleNext();
        });
      }, 7000);
    }
    scheduleNext();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.Text style={{ opacity, color: '#fff', fontSize: 14, fontWeight: '500' }}>
      {TAGLINES[index]}
    </Animated.Text>
  );
}
