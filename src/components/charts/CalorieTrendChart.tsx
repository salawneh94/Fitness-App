import { useState } from 'react';
import type { FoodEntry } from '../../types';
import { toISODate } from '../../lib/calc';
import SimpleBarChart from './SimpleBarChart';

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
      label: d.toLocaleDateString(undefined, range === 7 ? { weekday: 'short' } : { month: 'short', day: 'numeric' }),
      value: Math.round(totalsByDate.get(iso) ?? 0),
    };
  });

  const hasData = chartData.some((d) => d.value > 0);

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
        <SimpleBarChart
          data={chartData}
          referenceValue={targetCalories}
          referenceLabel={`${targetCalories} target`}
          color="var(--brand-primary)"
          unit="kcal"
        />
      )}
    </div>
  );
}
