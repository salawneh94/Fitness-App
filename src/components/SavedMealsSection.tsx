import { useState } from 'react';
import { Plus, Trash2, Utensils } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { MealType } from '../types';
import Card from './ui/Card';
import SavedMealBuilderModal from './SavedMealBuilderModal';

const MEAL_CHIPS: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'B' },
  { key: 'lunch', label: 'L' },
  { key: 'dinner', label: 'D' },
  { key: 'snack', label: 'S' },
];

export default function SavedMealsSection() {
  const savedMeals = useAppStore((s) => s.savedMeals);
  const removeSavedMeal = useAppStore((s) => s.removeSavedMeal);
  const logSavedMeal = useAppStore((s) => s.logSavedMeal);
  const [building, setBuilding] = useState(false);

  return (
    <Card
      title="Saved Meals"
      action={
        <button onClick={() => setBuilding(true)} className="flex items-center gap-1.5 text-sm font-medium text-cyan-600 dark:text-cyan-400">
          <Plus size={15} /> New
        </button>
      }
    >
      {savedMeals.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Save a frequently-eaten meal once, then re-log it in one tap instead of re-entering it every time.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-slate-800">
          {savedMeals.map((meal) => {
            const totalCals = meal.items.reduce((s, i) => s + i.calories * i.quantity, 0);
            return (
              <li key={meal.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 flex items-center gap-2">
                  <Utensils size={15} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{meal.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{meal.items.length} items · {Math.round(totalCals)} kcal</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {MEAL_CHIPS.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => logSavedMeal(meal.id, c.key)}
                      title={`Log to ${c.key}`}
                      className="w-7 h-7 rounded-full text-xs font-semibold border border-gray-300 dark:border-slate-700 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 hover:border-cyan-400"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {c.label}
                    </button>
                  ))}
                  <button onClick={() => removeSavedMeal(meal.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40">
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {building && <SavedMealBuilderModal onClose={() => setBuilding(false)} />}
    </Card>
  );
}
