import { View, Text } from 'react-native';
import type { UnitSystem } from '@fittrack/shared';
import { cmToFeetInches, feetInchesToCm } from '@fittrack/shared';
import { colors } from '@fittrack/shared';
import TextField from './text-field';

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
      <View className="relative justify-center">
        <TextField
          keyboardType="numeric"
          value={valueCm === '' ? '' : String(valueCm)}
          onChangeText={(v) => onChangeCm(v === '' ? '' : Number(v))}
          style={{ paddingRight: 48 }}
        />
        <Text className="absolute right-4 text-xs" style={{ color: colors.textMuted }} pointerEvents="none">
          cm
        </Text>
      </View>
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
    <View className="flex-row gap-2">
      <View className="relative flex-1 justify-center">
        <TextField
          keyboardType="numeric"
          value={feet === '' ? '' : String(feet)}
          onChangeText={(v) => update(v === '' ? '' : Number(v), inches)}
          style={{ paddingRight: 40 }}
        />
        <Text className="absolute right-4 text-xs" style={{ color: colors.textMuted }} pointerEvents="none">
          ft
        </Text>
      </View>
      <View className="relative flex-1 justify-center">
        <TextField
          keyboardType="numeric"
          value={inches === '' ? '' : String(inches)}
          onChangeText={(v) => update(feet, v === '' ? '' : Number(v))}
          style={{ paddingRight: 40 }}
        />
        <Text className="absolute right-4 text-xs" style={{ color: colors.textMuted }} pointerEvents="none">
          in
        </Text>
      </View>
    </View>
  );
}
