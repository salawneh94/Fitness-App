import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import { colors } from '@fittrack/shared';
import PressableScale from './pressable-scale';

const VISIBLE_MS = 5000;

/**
 * "Removed X · Undo", for a few seconds after a delete.
 *
 * A bin icon sits next to every logged entry, and one mis-tap used to lose the entry for good —
 * the kind of small loss that makes people stop trusting a log. Deleting stays one tap; this just
 * makes it reversible for long enough to notice.
 */
export default function UndoToast({ message, onUndo, onDone }: { message: string; onUndo: () => void; onDone: () => void }) {
  // The latest onDone, read when the timer fires. Depending on it directly would restart the timer
  // on every parent render (an inline callback is a new function each time), so a busy screen
  // could keep the toast up indefinitely.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => done.current(), VISIBLE_MS);
    return () => clearTimeout(t);
  }, [message]);

  return (
    <View pointerEvents="box-none" className="absolute left-0 right-0 bottom-4 items-center px-4">
      <View
        className="flex-row items-center gap-4 pl-4 pr-2 py-2 rounded-full"
        style={{ backgroundColor: '#1f2a40', borderWidth: 1, borderColor: colors.gridline, maxWidth: 480 }}
        accessibilityLiveRegion="polite"
      >
        <Text numberOfLines={1} className="text-sm flex-shrink" style={{ color: colors.textPrimary }}>
          {message}
        </Text>
        <PressableScale
          hapticStyle="selection"
          accessibilityRole="button"
          accessibilityLabel={`Undo: ${message}`}
          onPress={() => {
            onUndo();
            onDone();
          }}
          className="px-3 py-1.5 rounded-full"
        >
          <Text className="text-sm font-semibold" style={{ color: colors.brandPrimary }}>
            Undo
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}
