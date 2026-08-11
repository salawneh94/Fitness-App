import type { Micronutrients } from '../types';

const MICRO_META: { key: keyof Micronutrients; label: string; unit: string; rdi: number }[] = [
  { key: 'fiberG', label: 'Fiber', unit: 'g', rdi: 28 },
  { key: 'sugarG', label: 'Sugar', unit: 'g', rdi: 50 },
  { key: 'sodiumMg', label: 'Sodium', unit: 'mg', rdi: 2300 },
  { key: 'potassiumMg', label: 'Potassium', unit: 'mg', rdi: 3500 },
  { key: 'cholesterolMg', label: 'Cholesterol', unit: 'mg', rdi: 300 },
  { key: 'vitaminAMcg', label: 'Vitamin A', unit: 'mcg', rdi: 900 },
  { key: 'vitaminCMg', label: 'Vitamin C', unit: 'mg', rdi: 90 },
  { key: 'vitaminDMcg', label: 'Vitamin D', unit: 'mcg', rdi: 20 },
  { key: 'calciumMg', label: 'Calcium', unit: 'mg', rdi: 1000 },
  { key: 'ironMg', label: 'Iron', unit: 'mg', rdi: 18 },
  { key: 'vitaminB12Mcg', label: 'Vitamin B12', unit: 'mcg', rdi: 2.4 },
  { key: 'magnesiumMg', label: 'Magnesium', unit: 'mg', rdi: 400 },
  { key: 'zincMg', label: 'Zinc', unit: 'mg', rdi: 11 },
];

// Nutrients where exceeding 100% RDI is a caution rather than a win.
const CAP_NUTRIENTS = new Set(['sugarG', 'sodiumMg', 'cholesterolMg']);

export default function MicronutrientList({ totals }: { totals: Micronutrients }) {
  const rows = MICRO_META.map((m) => ({ ...m, value: totals[m.key] ?? 0 })).filter((r) => r.value > 0 || true);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
      {rows.map((r) => {
        const pct = r.rdi > 0 ? r.value / r.rdi : 0;
        const isCap = CAP_NUTRIENTS.has(r.key as string);
        const overCap = isCap && pct > 1;
        const barColor = overCap ? 'var(--status-warning)' : isCap ? 'var(--series-3)' : 'var(--series-1)';
        return (
          <div key={r.key}>
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
              <span className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {r.value % 1 === 0 ? r.value : r.value.toFixed(1)} {r.unit}
                <span style={{ color: 'var(--text-muted)' }}> / {r.rdi}{r.unit}</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--gridline)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(1, pct) * 100}%`, background: barColor, transition: 'width 0.4s ease' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
