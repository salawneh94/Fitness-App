import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { FoodEntry } from '@fittrack/shared';
import { colors, toISODate } from '@fittrack/shared';
import SimpleBarChart from './simple-bar-chart';

function addDays(date: Date, delta: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

export default function CalorieTrendChart({ foodEntries, targetCalories }: { foodEntries: FoodEntry[]; targetCalories: number }) {
  const [range, setRange] = useState<7 | 30>(7);

  const totalsByDate = new Map<string, number>();
  for (const f of foodEntries) {
    totalsByDate.set(f.date, (totalsByDate.get(f.date) ?? 0) + f.calories * f.quantity);
  }

  const today = new Date();
  const chartData = Array.from({ length: range }).map((_, i) => {
    const d = addDays(today, -(range - 1 - i));
    const iso = toISODate(d);
    return {
      label: d.toLocaleDateString(undefined, range === 7 ? { weekday: 'short' } : { month: 'short', day: 'numeric' }),
      value: Math.round(totalsByDate.get(iso) ?? 0),
    };
  });

  const hasData = chartData.some((d) => d.value > 0);

  return (
    <View>
      <View className="flex-row justify-end gap-1 mb-2">
        {([7, 30] as const).map((r) => (
          <Pressable
            key={r}
            onPress={() => setRange(r)}
            className="px-2.5 py-1 rounded-full"
            style={{ backgroundColor: range === r ? colors.brandPrimaryDark : 'transparent' }}
          >
            <Text className="text-xs font-medium" style={{ color: range === r ? 'white' : colors.textMuted }}>
              {r}d
            </Text>
          </Pressable>
        ))}
      </View>
      {!hasData ? (
        <View className="items-center justify-center px-4" style={{ height: 192 }}>
          <Text className="text-sm text-center" style={{ color: colors.textMuted }}>
            Log meals over a few days to see your calorie trend here.
          </Text>
        </View>
      ) : (
        <SimpleBarChart data={chartData} referenceValue={targetCalories} referenceLabel={`${targetCalories} target`} color={colors.brandPrimary} />
      )}
    </View>
  );
}
