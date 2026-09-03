import { View, Text } from 'react-native';
import type { UnitSystem } from '@fittrack/shared';
import { displayWeight, toKgFromDisplay, weightUnitLabel } from '@fittrack/shared';
import { colors } from '@fittrack/shared';
import TextField from './text-field';

export default function WeightInput({
  valueKg,
  onChangeKg,
  unit,
}: {
  valueKg: number | '';
  onChangeKg: (kg: number | '') => void;
  unit: UnitSystem;
}) {
  const displayValue = valueKg === '' ? '' : String(Math.round(displayWeight(valueKg, unit) * 10) / 10);

  return (
    <View className="relative justify-center">
      <TextField
        keyboardType="numeric"
        value={displayValue}
        onChangeText={(raw) => onChangeKg(raw === '' ? '' : toKgFromDisplay(Number(raw), unit))}
        style={{ paddingRight: 48 }}
      />
      <Text className="absolute right-4 text-xs" style={{ color: colors.textMuted }} pointerEvents="none">
        {weightUnitLabel(unit)}
      </Text>
    </View>
  );
}
