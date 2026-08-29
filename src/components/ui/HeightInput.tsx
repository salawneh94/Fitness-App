import type { UnitSystem } from '../../types';
import { cmToFeetInches, feetInchesToCm } from '../../lib/units';

const inputCls =
  'w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500';

export default function HeightInput({
  valueCm,
  onChangeCm,
  unit,
}: {
  valueCm: number | '';
  onChangeCm: (cm: number | '') => void;
  unit: UnitSystem;
}) {
  if (unit === 'metric') {
    return (
      <div className="relative">
        <input
          type="number"
          min={100}
          max={250}
          className={inputCls}
          value={valueCm}
          onChange={(e) => onChangeCm(e.target.value === '' ? '' : Number(e.target.value))}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'var(--text-muted)' }}>
          cm
        </span>
      </div>
    );
  }

  const { feet, inches } = valueCm === '' ? { feet: '' as number | '', inches: '' as number | '' } : cmToFeetInches(valueCm);

  function update(nextFeet: number | '', nextInches: number | '') {
    if (nextFeet === '' && nextInches === '') {
      onChangeCm('');
      return;
    }
    onChangeCm(feetInchesToCm(Number(nextFeet || 0), Number(nextInches || 0)));
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <input
          type="number"
          min={0}
          max={8}
          className={inputCls}
          value={feet}
          onChange={(e) => update(e.target.value === '' ? '' : Number(e.target.value), inches)}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'var(--text-muted)' }}>
          ft
        </span>
      </div>
      <div className="relative flex-1">
        <input
          type="number"
          min={0}
          max={11}
          className={inputCls}
          value={inches}
          onChange={(e) => update(feet, e.target.value === '' ? '' : Number(e.target.value))}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'var(--text-muted)' }}>
          in
        </span>
      </div>
    </div>
  );
}
