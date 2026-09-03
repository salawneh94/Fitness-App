import { colors } from '@fittrack/shared';
import LineTrendChart from './line-trend-chart';

export default function StrengthChart({ data, unit = 'kg' }: { data: { date: string; value: number }[]; unit?: string }) {
  return (
    <LineTrendChart
      data={data}
      unit={unit}
      seriesLabel="Est. 1RM"
      color={colors.series2}
      emptyMessage="Log sets with weight & reps for this exercise on a few different days to see your strength trend."
    />
  );
}
