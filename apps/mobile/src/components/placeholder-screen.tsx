import type { LucideIcon } from 'lucide-react-native';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PlaceholderScreen({ icon: Icon, title, note }: { icon: LucideIcon; title: string; note: string }) {
  return (
    <SafeAreaView className="flex-1 bg-[#0a0e17]">
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <View className="w-16 h-16 rounded-2xl bg-cyan-950 items-center justify-center">
          <Icon color="#22d3ee" size={28} />
        </View>
        <Text className="text-2xl font-bold text-white">{title}</Text>
        <Text className="text-sm text-center" style={{ color: '#8a95ab' }}>
          {note}
        </Text>
      </View>
    </SafeAreaView>
  );
}
