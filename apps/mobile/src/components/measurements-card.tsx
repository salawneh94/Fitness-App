import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppStore } from '@/store/useAppStore';
import type { BodyMeasurementEntry, MeasurementKey, UnitSystem } from '@fittrack/shared';
import { colors, displayLength, lengthUnitLabel } from '@fittrack/shared';
import Card from './ui/card';
import LengthInput from './ui/length-input';
import LineTrendChart from './charts/line-trend-chart';

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
    updateMeasurement(fields as Omit<BodyMeasurementEntry, 'date'>);
    setDraft({ waistCm: '', chestCm: '', armsCm: '', hipsCm: '', thighsCm: '' });
  }

  const chartData = measurementsHistory
    .filter((m) => m[selected] !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ date: m.date, value: Math.round(displayLength(m[selected] as number, unit) * 10) / 10 }));

  return (
    <Card title="Body Measurements">
      <View className="flex-row flex-wrap gap-3 mb-4">
        {FIELDS.map(({ key, label }) => (
          <View key={key} style={{ width: '47%' }}>
            <Text className="text-xs font-medium mb-1" style={{ color: colors.textMuted }}>
              {label}
            </Text>
            <LengthInput valueCm={draft[key]} onChangeCm={(v) => setDraft((d) => ({ ...d, [key]: v }))} unit={unit} />
          </View>
        ))}
      </View>
      <Pressable onPress={save} className="self-start px-4 py-2 rounded-full mb-4" style={{ backgroundColor: colors.brandPrimaryDark }}>
        <Text className="text-white text-sm font-semibold">Save</Text>
      </Pressable>

      <View className="flex-row flex-wrap gap-1.5 mb-3">
        {FIELDS.map(({ key, label }) => {
          const isSelected = selected === key;
          return (
            <Pressable
              key={key}
              onPress={() => setSelected(key)}
              className="px-2.5 py-1.5 rounded-full border"
              style={{
                backgroundColor: isSelected ? colors.brandPrimaryDark : 'transparent',
                borderColor: isSelected ? colors.brandPrimaryDark : colors.gridline,
              }}
            >
              <Text className="text-xs" style={{ color: isSelected ? 'white' : colors.textSecondary }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <LineTrendChart
        data={chartData}
        unit={lengthUnitLabel(unit)}
        seriesLabel={FIELDS.find((f) => f.key === selected)?.label}
        color={colors.brandLime}
        emptyMessage="Log this measurement on a couple of different days to see its trend here."
      />
    </Card>
  );
}
