import { Picker } from '@react-native-picker/picker';
import { View } from 'react-native';
import { colors } from '@fittrack/shared';

export default function SelectField<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <View className="rounded-xl border overflow-hidden" style={{ backgroundColor: colors.chartSurface, borderColor: colors.gridline }}>
      <Picker
        selectedValue={value}
        onValueChange={(v) => onChange(v as T)}
        style={{ color: colors.textPrimary }}
        dropdownIconColor={colors.textMuted}
      >
        {options.map((o) => (
          <Picker.Item key={o.value} label={o.label} value={o.value} color={colors.textPrimary} />
        ))}
      </Picker>
    </View>
  );
}
