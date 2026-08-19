import type { UnitSystem } from '../../types';
import { displayWeight, toKgFromDisplay, weightUnitLabel } from '../../lib/units';

const inputCls =
  'w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500';

export default function WeightInput({
  valueKg,
  onChangeKg,
  unit,
  className = inputCls,
  ...rest
}: {
  valueKg: number | '';
  onChangeKg: (kg: number | '') => void;
  unit: UnitSystem;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const displayValue = valueKg === '' ? '' : Math.round(displayWeight(valueKg, unit) * 10) / 10;

  return (
    <div className="relative">
      <input
        type="number"
        className={className}
        value={displayValue}
        onChange={(e) => {
          const raw = e.target.value;
          onChangeKg(raw === '' ? '' : toKgFromDisplay(Number(raw), unit));
        }}
        {...rest}
      />
      <span
        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
        style={{ color: 'var(--text-muted)' }}
      >
        {weightUnitLabel(unit)}
      </span>
    </div>
  );
}
