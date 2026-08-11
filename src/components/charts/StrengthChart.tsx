import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { format, parseISO } from 'date-fns';

export default function StrengthChart({
  data,
  unit = 'kg',
}: {
  data: { date: string; value: number }[];
  unit?: string;
}) {
  if (data.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-center px-4" style={{ color: 'var(--text-muted)' }}>
        Log sets with weight & reps for this exercise on a few different days to see your strength trend.
      </div>
    );
  }

  const chartData = data.map((d) => ({ ...d, label: format(parseISO(d.date), 'MMM d') }));

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
            width={44}
            domain={['dataMin - 2', 'dataMax + 2']}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--chart-surface)',
              border: '1px solid var(--gridline)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--text-primary)',
            }}
            formatter={(value) => [`${Math.round(Number(value))} ${unit}`, 'Est. 1RM']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--series-2)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--series-2)' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
