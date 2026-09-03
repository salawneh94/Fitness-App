import { TriangleAlert } from 'lucide-react-native';
import { View, Text } from 'react-native';
import { colors } from '@fittrack/shared';

export default function RestDayBanner({ consecutiveDays }: { consecutiveDays: number }) {
  return (
    <View
      className="flex-row items-start gap-3 p-4 rounded-2xl border"
      style={{ backgroundColor: 'rgba(251, 191, 36, 0.08)', borderColor: 'rgba(251, 191, 36, 0.35)' }}
    >
      <TriangleAlert size={18} color={colors.statusWarning} style={{ marginTop: 2 }} />
      <View className="flex-1">
        <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
          {consecutiveDays} days trained in a row — consider a rest day
        </Text>
        <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
          Recovery is when muscles actually rebuild stronger. A day off (or light active recovery) now can help
          prevent injury and burnout.
        </Text>
      </View>
    </View>
  );
}
