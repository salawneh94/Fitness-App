import { View, Text } from 'react-native';
import { colors } from '@fittrack/shared';

interface MacroRow {
  label: string;
  consumed: number;
  target: number;
  unit: string;
  color: string;
}

function Bar({ row }: { row: MacroRow }) {
  const pct = row.target > 0 ? Math.min(1, row.consumed / row.target) : 0;
  const over = row.consumed > row.target;
  return (
    <View>
      <View className="flex-row justify-between mb-1">
        <View className="flex-row items-center gap-2">
          <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.color }} />
          <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
            {row.label}
          </Text>
        </View>
        <Text className="text-sm" style={{ color: colors.textSecondary }}>
          {Math.round(row.consumed)} / {Math.round(row.target)} {row.unit}
        </Text>
      </View>
      <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.gridline }}>
        <View
          className="h-full rounded-full"
          style={{ width: `${pct * 100}%`, backgroundColor: over ? colors.statusWarning : row.color }}
        />
      </View>
    </View>
  );
}

export default function MacroBars({
  protein,
  carbs,
  fat,
}: {
  protein: { consumed: number; target: number };
  carbs: { consumed: number; target: number };
  fat: { consumed: number; target: number };
}) {
  const rows: MacroRow[] = [
    { label: 'Protein', unit: 'g', color: colors.series1, ...protein },
    { label: 'Carbs', unit: 'g', color: colors.series2, ...carbs },
    { label: 'Fat', unit: 'g', color: colors.series3, ...fat },
  ];
  return (
    <View className="gap-3.5">
      {rows.map((r) => (
        <Bar key={r.label} row={r} />
      ))}
    </View>
  );
}
