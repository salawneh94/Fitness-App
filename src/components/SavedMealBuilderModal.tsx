import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { SavedMealItem } from '../types';

const inputCls =
  'w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500';

const emptyItem = { name: '', calories: 0, proteinG: 0, carbsG: 0, fatG: 0, quantity: 1, servingLabel: 'serving' };

export default function SavedMealBuilderModal({ onClose }: { onClose: () => void }) {
  const addSavedMeal = useAppStore((s) => s.addSavedMeal);
  const [mealName, setMealName] = useState('');
  const [items, setItems] = useState<SavedMealItem[]>([]);
  const [draft, setDraft] = useState(emptyItem);

  function addItem() {
    if (!draft.name.trim()) return;
    setItems((prev) => [...prev, { ...draft, name: draft.name.trim() }]);
    setDraft(emptyItem);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function save() {
    if (!mealName.trim() || items.length === 0) return;
    addSavedMeal(mealName.trim(), items);
    onClose();
  }

  const totalCalories = items.reduce((s, i) => s + i.calories * i.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>New Saved Meal</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <label className="block mb-4">
          <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Meal name</span>
          <input className={inputCls} value={mealName} onChange={(e) => setMealName(e.target.value)} placeholder="My usual breakfast" />
        </label>

        {items.length > 0 && (
          <ul className="mb-4 divide-y divide-gray-100 dark:divide-neutral-800">
            {items.map((item, idx) => (
              <li key={idx} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {item.quantity} × {item.servingLabel} · {Math.round(item.calories * item.quantity)} kcal
                  </p>
                </div>
                <button onClick={() => removeItem(idx)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500">
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
            <li className="pt-2 text-sm font-medium flex justify-between" style={{ color: 'var(--text-primary)' }}>
              <span>Total</span>
              <span>{Math.round(totalCalories)} kcal</span>
            </li>
          </ul>
        )}

        <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-3 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Add item</p>
          <div className="space-y-2">
            <input
              className={inputCls}
              placeholder="Food name"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
            <div className="grid grid-cols-4 gap-2">
              <input type="number" min={0} className={inputCls} placeholder="kcal" value={draft.calories || ''} onChange={(e) => setDraft((d) => ({ ...d, calories: Number(e.target.value) }))} />
              <input type="number" min={0} className={inputCls} placeholder="protein g" value={draft.proteinG || ''} onChange={(e) => setDraft((d) => ({ ...d, proteinG: Number(e.target.value) }))} />
              <input type="number" min={0} className={inputCls} placeholder="carbs g" value={draft.carbsG || ''} onChange={(e) => setDraft((d) => ({ ...d, carbsG: Number(e.target.value) }))} />
              <input type="number" min={0} className={inputCls} placeholder="fat g" value={draft.fatG || ''} onChange={(e) => setDraft((d) => ({ ...d, fatG: Number(e.target.value) }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min={0.25} step={0.25} className={inputCls} placeholder="servings" value={draft.quantity} onChange={(e) => setDraft((d) => ({ ...d, quantity: Number(e.target.value) }))} />
              <input className={inputCls} placeholder="serving label" value={draft.servingLabel} onChange={(e) => setDraft((d) => ({ ...d, servingLabel: e.target.value }))} />
            </div>
            <button
              type="button"
              onClick={addItem}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-gray-300 dark:border-neutral-700 text-sm font-medium text-orange-600 dark:text-orange-400"
            >
              <Plus size={15} /> Add item to meal
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-neutral-700 text-sm font-medium">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!mealName.trim() || items.length === 0}
            className="flex-1 py-2.5 rounded-full bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white text-sm font-semibold"
          >
            Save Meal
          </button>
        </div>
      </div>
    </div>
  );
}
