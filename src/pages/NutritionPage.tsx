import { useState } from 'react';
import { Plus, Trash2, ScanBarcode } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { MealType } from '../types';
import { calcDailyTargets, todayISO } from '../lib/calc';
import Card from '../components/ui/Card';
import CalorieRing from '../components/charts/CalorieRing';
import MacroBars from '../components/charts/MacroBars';
import MicronutrientList from '../components/MicronutrientList';
import AddFoodModal from '../components/AddFoodModal';
import SavedMealsSection from '../components/SavedMealsSection';
import type { Micronutrients } from '../types';

const MEALS: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snacks' },
];

export default function NutritionPage() {
  const profile = useAppStore((s) => s.profile);
  const foodEntries = useAppStore((s) => s.foodEntries);
  const removeFoodEntry = useAppStore((s) => s.removeFoodEntry);
  const [addingMeal, setAddingMeal] = useState<MealType | null>(null);

  if (!profile) return null;

  const today = todayISO();
  const todaysFood = foodEntries.filter((f) => f.date === today);
  const targets = calcDailyTargets(profile);

  const consumed = todaysFood.reduce(
    (acc, f) => ({
      calories: acc.calories + f.calories * f.quantity,
      proteinG: acc.proteinG + f.proteinG * f.quantity,
      carbsG: acc.carbsG + f.carbsG * f.quantity,
      fatG: acc.fatG + f.fatG * f.quantity,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );

  const microTotals: Micronutrients = {};
  for (const f of todaysFood) {
    if (!f.micros) continue;
    for (const [k, v] of Object.entries(f.micros)) {
      if (typeof v !== 'number') continue;
      const key = k as keyof Micronutrients;
      microTotals[key] = (microTotals[key] ?? 0) + v * f.quantity;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Nutrition</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Log meals manually or scan a barcode for instant nutrition info.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Calories">
          <CalorieRing consumed={consumed.calories} target={targets.calories} />
        </Card>
        <Card title="Macros">
          <MacroBars
            protein={{ consumed: consumed.proteinG, target: targets.proteinG }}
            carbs={{ consumed: consumed.carbsG, target: targets.carbsG }}
            fat={{ consumed: consumed.fatG, target: targets.fatG }}
          />
        </Card>
      </div>

      <Card title="Micronutrients Today">
        <MicronutrientList totals={microTotals} />
      </Card>

      <SavedMealsSection />

      <div className="space-y-4">
        {MEALS.map(({ key, label }) => {
          const entries = todaysFood.filter((f) => f.meal === key);
          const mealCals = entries.reduce((s, e) => s + e.calories * e.quantity, 0);
          return (
            <Card
              key={key}
              title={label}
              action={
                <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                  {Math.round(mealCals)} kcal
                </span>
              }
            >
              {entries.length === 0 ? (
                <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>Nothing logged yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-slate-800 mb-3">
                  {entries.map((e) => (
                    <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                          {e.source === 'barcode' && <ScanBarcode size={13} className="shrink-0" style={{ color: 'var(--text-muted)' }} />}
                          {e.name}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {e.quantity} × {e.servingLabel ?? 'serving'} · {Math.round(e.calories * e.quantity)} kcal
                        </p>
                      </div>
                      <button
                        onClick={() => removeFoodEntry(e.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0"
                        aria-label={`Remove ${e.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => setAddingMeal(key)}
                className="flex items-center gap-1.5 text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-700"
              >
                <Plus size={16} /> Add food
              </button>
            </Card>
          );
        })}
      </div>

      {addingMeal && <AddFoodModal meal={addingMeal} onClose={() => setAddingMeal(null)} />}
    </div>
  );
}
