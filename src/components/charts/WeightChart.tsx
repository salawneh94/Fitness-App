import type { UnitSystem, WeightEntry } from '../../types';
import { displayWeight, weightUnitLabel } from '../../lib/units';
import SimpleLineChart from './SimpleLineChart';

export default function WeightChart({ data, unit = 'metric' }: { data: WeightEntry[]; unit?: UnitSystem }) {
  if (data.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Log your weight on a few different days to see your trend here.
      </div>
    );
  }

  const points = data.map((d) => ({
    date: d.date,
    value: Math.round(displayWeight(d.weightKg, unit) * 10) / 10,
  }));

  return (
    <SimpleLineChart
      data={points}
      unit={weightUnitLabel(unit)}
      seriesLabel="Weight"
      color="var(--series-1)"
      pad={1}
    />
  );
}
