import { View, Text } from 'react-native';
import { colors } from '@fittrack/shared';
import RingGauge from './ring-gauge';
import CountUp from '../ui/count-up';

export default function CalorieRing({
  consumed,
  target,
  burned = 0,
}: {
  consumed: number;
  target: number;
  burned?: number;
}) {
  const remaining = Math.max(0, target - consumed + burned);
  const over = consumed > target;

  const rows = [
    { label: 'Target', value: `${target} kcal` },
    { label: 'Consumed', value: `${Math.round(consumed)} kcal` },
    ...(burned > 0 ? [{ label: 'Burned (exercise)', value: `+${Math.round(burned)} kcal` }] : []),
  ];

  return (
    <View className="flex-row items-center gap-6">
      <RingGauge
        value={consumed}
        target={target}
        centerValue={<CountUp value={Math.round(remaining)} />}
        centerLabel={over ? 'over target' : 'kcal left'}
      />
      <View className="gap-1.5 flex-1">
        {rows.map((r) => (
          <View key={r.label} className="flex-row justify-between gap-4">
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              {r.label}
            </Text>
            <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
              {r.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
