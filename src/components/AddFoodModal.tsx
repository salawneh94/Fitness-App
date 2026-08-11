import { useState } from 'react';
import { X, ScanBarcode, PenLine, Loader2, CheckCircle2, Utensils } from 'lucide-react';
import BarcodeScannerModal from './BarcodeScannerModal';
import { lookupBarcode, type ScannedProduct } from '../lib/foodApi';
import type { FoodEntry, MealType } from '../types';
import { useAppStore } from '../store/useAppStore';
import { todayISO } from '../lib/calc';

const inputCls =
  'w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500';

type Mode = 'choose' | 'scan' | 'manual' | 'confirmScanned' | 'savedMeals';

export default function AddFoodModal({ meal, onClose }: { meal: MealType; onClose: () => void }) {
  const addFoodEntry = useAppStore((s) => s.addFoodEntry);
  const savedMeals = useAppStore((s) => s.savedMeals);
  const logSavedMeal = useAppStore((s) => s.logSavedMeal);
  const [mode, setMode] = useState<Mode>('choose');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState<ScannedProduct | null>(null);
  const [grams, setGrams] = useState(100);

  const [manual, setManual] = useState({
    name: '',
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    quantity: 1,
    servingLabel: 'serving',
  });

  async function handleDetected(barcode: string) {
    setMode('choose');
    setLoading(true);
    setError(null);
    try {
      const product = await lookupBarcode(barcode);
      if (!product) {
        setError(`No product found for barcode ${barcode}. Try manual entry.`);
      } else {
        setScanned(product);
        setGrams(100);
        setMode('confirmScanned');
      }
    } catch {
      setError('Could not reach the product database. Check your connection or use manual entry.');
    } finally {
      setLoading(false);
    }
  }

  function confirmScanned() {
    if (!scanned) return;
    const factor = grams / 100;
    const entry: Omit<FoodEntry, 'id' | 'loggedAt'> = {
      date: todayISO(),
      meal,
      name: scanned.name,
      brand: scanned.brand,
      quantity: 1,
      servingLabel: `${grams} g`,
      calories: Math.round(scanned.caloriesPer100g * factor),
      proteinG: Math.round(scanned.proteinPer100g * factor * 10) / 10,
      carbsG: Math.round(scanned.carbsPer100g * factor * 10) / 10,
      fatG: Math.round(scanned.fatPer100g * factor * 10) / 10,
      micros: Object.fromEntries(
        Object.entries(scanned.microsPer100g)
          .filter(([, v]) => typeof v === 'number')
          .map(([k, v]) => [k, Math.round((v as number) * factor * 10) / 10])
      ),
      source: 'barcode',
      barcode: scanned.barcode,
    };
    addFoodEntry(entry);
    onClose();
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manual.name.trim()) return;
    addFoodEntry({
      date: todayISO(),
      meal,
      name: manual.name.trim(),
      quantity: manual.quantity,
      servingLabel: manual.servingLabel,
      calories: manual.calories,
      proteinG: manual.proteinG,
      carbsG: manual.carbsG,
      fatG: manual.fatG,
      source: 'manual',
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
            Add to {meal}
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm py-8 justify-center" style={{ color: 'var(--text-secondary)' }}>
            <Loader2 size={18} className="animate-spin" /> Looking up product…
          </div>
        )}

        {!loading && mode === 'choose' && (
          <div className="space-y-3">
            {error && <p className="text-sm text-amber-600 dark:text-amber-400">{error}</p>}
            <button
              onClick={() => setMode('scan')}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 text-left"
            >
              <ScanBarcode className="text-orange-600 dark:text-orange-400" />
              <div>
                <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>Scan Barcode / QR</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Auto-fill nutrition from packaging</p>
              </div>
            </button>
            <button
              onClick={() => setMode('manual')}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 text-left"
            >
              <PenLine className="text-orange-600 dark:text-orange-400" />
              <div>
                <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>Manual Entry</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Type in the details yourself</p>
              </div>
            </button>
            {savedMeals.length > 0 && (
              <button
                onClick={() => setMode('savedMeals')}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 text-left"
              >
                <Utensils className="text-orange-600 dark:text-orange-400" />
                <div>
                  <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>From Saved Meals</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Quick-add a meal you've saved before</p>
                </div>
              </button>
            )}
          </div>
        )}

        {mode === 'savedMeals' && (
          <div className="space-y-2">
            {savedMeals.map((m) => {
              const totalCals = m.items.reduce((s, i) => s + i.calories * i.quantity, 0);
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    logSavedMeal(m.id, meal);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 text-left"
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{m.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.items.length} items</p>
                  </div>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{Math.round(totalCals)} kcal</span>
                </button>
              );
            })}
            <button
              onClick={() => setMode('choose')}
              className="w-full py-2.5 rounded-lg border border-gray-300 dark:border-neutral-700 text-sm font-medium"
            >
              Back
            </button>
          </div>
        )}

        {mode === 'scan' && (
          <BarcodeScannerModal onDetected={handleDetected} onClose={() => setMode('choose')} />
        )}

        {mode === 'confirmScanned' && scanned && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/40">
              <CheckCircle2 size={18} className="text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{scanned.name}</p>
                {scanned.brand && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{scanned.brand}</p>}
              </div>
            </div>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Amount (grams)</span>
              <input
                type="number"
                min={1}
                className={inputCls}
                value={grams}
                onChange={(e) => setGrams(Number(e.target.value))}
              />
            </label>
            <div className="grid grid-cols-4 gap-2 text-center text-sm">
              <MiniStat label="kcal" value={Math.round(scanned.caloriesPer100g * (grams / 100))} />
              <MiniStat label="protein" value={`${Math.round(scanned.proteinPer100g * (grams / 100))}g`} />
              <MiniStat label="carbs" value={`${Math.round(scanned.carbsPer100g * (grams / 100))}g`} />
              <MiniStat label="fat" value={`${Math.round(scanned.fatPer100g * (grams / 100))}g`} />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('choose')}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-neutral-700 text-sm font-medium"
              >
                Back
              </button>
              <button
                onClick={confirmScanned}
                className="flex-1 py-2.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold"
              >
                Add to log
              </button>
            </div>
          </div>
        )}

        {mode === 'manual' && (
          <form onSubmit={submitManual} className="space-y-3">
            <label className="block">
              <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Food name</span>
              <input
                required
                className={inputCls}
                value={manual.name}
                onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))}
                placeholder="Grilled chicken breast"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Calories</span>
                <input type="number" min={0} className={inputCls} value={manual.calories} onChange={(e) => setManual((m) => ({ ...m, calories: Number(e.target.value) }))} />
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Servings</span>
                <input type="number" min={0.25} step={0.25} className={inputCls} value={manual.quantity} onChange={(e) => setManual((m) => ({ ...m, quantity: Number(e.target.value) }))} />
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Protein (g)</span>
                <input type="number" min={0} className={inputCls} value={manual.proteinG} onChange={(e) => setManual((m) => ({ ...m, proteinG: Number(e.target.value) }))} />
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Carbs (g)</span>
                <input type="number" min={0} className={inputCls} value={manual.carbsG} onChange={(e) => setManual((m) => ({ ...m, carbsG: Number(e.target.value) }))} />
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Fat (g)</span>
                <input type="number" min={0} className={inputCls} value={manual.fatG} onChange={(e) => setManual((m) => ({ ...m, fatG: Number(e.target.value) }))} />
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Serving label</span>
                <input className={inputCls} value={manual.servingLabel} onChange={(e) => setManual((m) => ({ ...m, servingLabel: e.target.value }))} placeholder="1 cup" />
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-neutral-700 text-sm font-medium"
              >
                Back
              </button>
              <button type="submit" className="flex-1 py-2.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold">
                Add to log
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-neutral-800 py-2">
      <p className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</p>
      <p className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  );
}
