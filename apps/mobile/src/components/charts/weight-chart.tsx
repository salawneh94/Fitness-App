import { Text, View } from 'react-native';
import type { UnitSystem, WeightEntry } from '@fittrack/shared';
import { colors, displayWeight, weightUnitLabel } from '@fittrack/shared';
import SimpleLineChart from './simple-line-chart';

export default function WeightChart({ data, unit = 'metric' }: { data: WeightEntry[]; unit?: UnitSystem }) {
  if (data.length < 2) {
    return (
      <View className="items-center justify-center" style={{ height: 192 }}>
        <Text className="text-sm" style={{ color: colors.textMuted }}>
          Log your weight on a few different days to see your trend here.
        </Text>
      </View>
    );
  }

  const points = data.map((d) => ({
    date: d.date,
    value: Math.round(displayWeight(d.weightKg, unit) * 10) / 10,
  }));

  return <SimpleLineChart data={points} unit={weightUnitLabel(unit)} seriesLabel="Weight" color={colors.series1} pad={1} />;
}
