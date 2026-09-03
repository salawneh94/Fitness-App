import { View, Text } from 'react-native';
import type { UnitSystem } from '@fittrack/shared';
import { displayLength, lengthUnitLabel, toCmFromDisplay } from '@fittrack/shared';
import { colors } from '@fittrack/shared';
import TextField from './text-field';

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
  const displayValue = valueCm === '' ? '' : String(Math.round(displayLength(valueCm, unit) * 10) / 10);

  return (
    <View className="relative justify-center">
      <TextField
        keyboardType="numeric"
        placeholder={placeholder}
        value={displayValue}
        onChangeText={(raw) => onChangeCm(raw === '' ? '' : toCmFromDisplay(Number(raw), unit))}
        style={{ paddingRight: 48 }}
      />
      <Text className="absolute right-4 text-xs" style={{ color: colors.textMuted }} pointerEvents="none">
        {lengthUnitLabel(unit)}
      </Text>
    </View>
  );
}
