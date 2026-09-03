import { Text, View } from 'react-native';
import { colors } from '@fittrack/shared';
import SimpleLineChart from './simple-line-chart';

export default function LineTrendChart({
  data,
  unit = '',
  seriesLabel = 'Value',
  color = colors.series2,
  emptyMessage = 'Log a few entries on different days to see your trend here.',
}: {
  data: { date: string; value: number }[];
  unit?: string;
  seriesLabel?: string;
  color?: string;
  emptyMessage?: string;
}) {
  if (data.length < 2) {
    return (
      <View className="items-center justify-center px-4" style={{ height: 192 }}>
        <Text className="text-sm text-center" style={{ color: colors.textMuted }}>
          {emptyMessage}
        </Text>
      </View>
    );
  }

  return <SimpleLineChart data={data} unit={unit} seriesLabel={seriesLabel} color={color} pad={2} />;
}
