import { Pressable, Text, View } from 'react-native';
import type { UnitSystem } from '@fittrack/shared';
import { colors } from '@fittrack/shared';

export default function UnitToggle({ value, onChange }: { value: UnitSystem; onChange: (u: UnitSystem) => void }) {
  const options: UnitSystem[] = ['metric', 'imperial'];
  return (
    <View className="flex-row rounded-full border p-0.5" style={{ borderColor: colors.gridline }}>
      {options.map((u) => (
        <Pressable
          key={u}
          onPress={() => onChange(u)}
          className="px-3 py-1.5 rounded-full"
          style={{ backgroundColor: value === u ? colors.brandPrimaryDark : 'transparent' }}
        >
          <Text className="text-xs font-semibold" style={{ color: value === u ? '#fff' : colors.textMuted }}>
            {u === 'metric' ? 'kg / cm' : 'lb / ft-in'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
