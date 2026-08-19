import type { UnitSystem } from '../../types';
import { displayLength, lengthUnitLabel, toCmFromDisplay } from '../../lib/units';

const inputCls =
  'w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500';

export default function LengthInput({
  valueCm,
  onChangeCm,
  unit,
  placeholder,
}: {
  valueCm: number | '';
  onChangeCm: (cm: number | '') => void;
  unit: UnitSystem;
  placeholder?: string;
}) {
  const displayValue = valueCm === '' ? '' : Math.round(displayLength(valueCm, unit) * 10) / 10;

  return (
    <div className="relative">
      <input
        type="number"
        min={0}
        step={0.5}
        placeholder={placeholder}
        className={inputCls}
        value={displayValue}
        onChange={(e) => {
          const raw = e.target.value;
          onChangeCm(raw === '' ? '' : toCmFromDisplay(Number(raw), unit));
        }}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'var(--text-muted)' }}>
        {lengthUnitLabel(unit)}
      </span>
    </div>
  );
}
