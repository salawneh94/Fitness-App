import type { UnitSystem } from '@fittrack/shared';

export default function UnitToggle({ value, onChange }: { value: UnitSystem; onChange: (u: UnitSystem) => void }) {
  return (
    <div className="inline-flex rounded-full border border-gray-300 dark:border-slate-700 p-0.5">
      {(['metric', 'imperial'] as UnitSystem[]).map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => onChange(u)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            value === u
              ? 'bg-cyan-600 text-white'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {u === 'metric' ? 'kg / cm' : 'lb / ft-in'}
        </button>
      ))}
    </div>
  );
}
