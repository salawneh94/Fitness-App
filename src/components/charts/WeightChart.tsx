import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import type { UnitSystem, WeightEntry } from '../../types';
import { format, parseISO } from 'date-fns';
import { displayWeight, weightUnitLabel } from '../../lib/units';

export default function WeightChart({ data, unit = 'metric' }: { data: WeightEntry[]; unit?: UnitSystem }) {
  if (data.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Log your weight on a few different days to see your trend here.
      </div>
    );
  }

  const chartData = data
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      label: format(parseISO(d.date), 'MMM d'),
      weight: Math.round(displayWeight(d.weightKg, unit) * 10) / 10,
    }));

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="var(--gridline)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            axisLine={{ stroke: 'var(--baseline)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            axisLine={false}
            tickLine={false}
            width={40}
            domain={['dataMin - 1', 'dataMax + 1']}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--chart-surface)',
              border: '1px solid var(--gridline)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--text-primary)',
            }}
            formatter={(value) => [`${value} ${weightUnitLabel(unit)}`, 'Weight']}
          />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--series-1)' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
