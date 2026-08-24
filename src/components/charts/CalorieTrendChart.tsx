import { useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import { format } from 'date-fns';
import type { FoodEntry } from '../../types';
import { toISODate } from '../../lib/calc';

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
    // Local calendar date — entries are stored by the user's own day, so a UTC conversion here
    // would look up the wrong bucket and shift the whole chart by a day.
    const iso = toISODate(d);
    return {
      label: format(d, range === 7 ? 'EEE' : 'MMM d'),
      calories: Math.round(totalsByDate.get(iso) ?? 0),
    };
  });

  const hasData = chartData.some((d) => d.calories > 0);

  return (
    <div>
      <div className="flex justify-end gap-1 mb-2">
        {([7, 30] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              range === r ? 'bg-orange-600 text-white' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {r}d
          </button>
        ))}
      </div>
      {!hasData ? (
        <div className="h-48 flex items-center justify-center text-sm text-center px-4" style={{ color: 'var(--text-muted)' }}>
          Log meals over a few days to see your calorie trend here.
        </div>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="var(--gridline)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={{ stroke: 'var(--baseline)' }}
                tickLine={false}
                interval={range === 30 ? 4 : 0}
              />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={44} />
              <ReferenceLine y={targetCalories} stroke="var(--text-muted)" strokeDasharray="4 4" />
              <Tooltip
                contentStyle={{
                  background: 'var(--chart-surface)',
                  border: '1px solid var(--gridline)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'var(--text-primary)',
                }}
                formatter={(value) => [`${value} kcal`, 'Consumed']}
              />
              <Bar dataKey="calories" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
