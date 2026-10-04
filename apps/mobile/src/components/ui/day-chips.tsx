import { ScrollView, Text } from 'react-native';
import { addDaysISO, colors, parseISODate, todayISO } from '@fittrack/shared';
import PressableScale from './pressable-scale';

/**
 * Today, yesterday, or a few days back — for a session logged after the fact.
 *
 * A week is the useful window: long enough for a forgotten weekend, short enough to stay one
 * row. Never the future — a session hasn't happened until it has.
 */
export default function DayChips({ value, onChange, days = 7 }: { value: string; onChange: (iso: string) => void; days?: number }) {
  const today = todayISO();
  const options = Array.from({ length: days }, (_, i) => addDaysISO(today, -i));
  const label = (iso: string, i: number) =>
    i === 0
      ? 'Today'
      : i === 1
        ? 'Yesterday'
        : // Built from parts: asked for weekday + day together, some locales (en-US among them)
          // answer "2 Fri".
          `${parseISODate(iso).toLocaleDateString(undefined, { weekday: 'short' })} ${parseISODate(iso).getDate()}`;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Day">
      {options.map((iso, i) => {
        const selected = iso === value;
        return (
          <PressableScale
            key={iso}
            hapticStyle="selection"
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(iso)}
            className="px-3.5 py-1.5 rounded-full border"
            style={{ borderColor: selected ? colors.brandPrimary : colors.gridline, backgroundColor: selected ? 'rgba(34,211,238,0.12)' : 'transparent' }}
          >
            <Text className="text-xs font-medium" style={{ color: selected ? colors.brandPrimary : colors.textSecondary }}>
              {label(iso, i)}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}
