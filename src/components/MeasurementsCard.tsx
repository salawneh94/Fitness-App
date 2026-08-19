import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { BodyMeasurementEntry, MeasurementKey, UnitSystem } from '../types';
import { displayLength, lengthUnitLabel } from '../lib/units';
import Card from './ui/Card';
import LengthInput from './ui/LengthInput';
import LineTrendChart from './charts/LineTrendChart';

const FIELDS: { key: MeasurementKey; label: string }[] = [
  { key: 'waistCm', label: 'Waist' },
  { key: 'chestCm', label: 'Chest' },
  { key: 'armsCm', label: 'Arms' },
  { key: 'hipsCm', label: 'Hips' },
  { key: 'thighsCm', label: 'Thighs' },
];

export default function MeasurementsCard({ unit }: { unit: UnitSystem }) {
  const measurementsHistory = useAppStore((s) => s.measurementsHistory);
  const updateMeasurement = useAppStore((s) => s.updateMeasurement);

  const [draft, setDraft] = useState<Record<MeasurementKey, number | ''>>({
    waistCm: '',
    chestCm: '',
    armsCm: '',
    hipsCm: '',
    thighsCm: '',
  });
  const [selected, setSelected] = useState<MeasurementKey>('waistCm');

  function save() {
    const fields: Partial<Omit<BodyMeasurementEntry, 'date'>> = {};
    for (const { key } of FIELDS) {
      if (draft[key] !== '') fields[key] = draft[key] as number;
    }
    if (Object.keys(fields).length === 0) return;
    updateMeasurement(fields);
    setDraft({ waistCm: '', chestCm: '', armsCm: '', hipsCm: '', thighsCm: '' });
  }

  const chartData = measurementsHistory
    .filter((m) => m[selected] !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ date: m.date, value: Math.round(displayLength(m[selected] as number, unit) * 10) / 10 }));

  return (
    <Card title="Body Measurements">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {FIELDS.map(({ key, label }) => (
          <label key={key} className="block">
            <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{label}</span>
            <LengthInput valueCm={draft[key]} onChangeCm={(v) => setDraft((d) => ({ ...d, [key]: v }))} unit={unit} />
          </label>
        ))}
      </div>
      <button
        onClick={save}
        className="px-4 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold mb-4"
      >
        Save
      </button>

      <select
        className="mb-3 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
        value={selected}
        onChange={(e) => setSelected(e.target.value as MeasurementKey)}
      >
        {FIELDS.map(({ key, label }) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
      <LineTrendChart
        data={chartData}
        unit={lengthUnitLabel(unit)}
        seriesLabel={FIELDS.find((f) => f.key === selected)?.label}
        color="var(--brand-lime)"
        emptyMessage="Log this measurement on a couple of different days to see its trend here."
      />
    </Card>
  );
}
