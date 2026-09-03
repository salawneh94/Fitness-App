import { ExternalLink, X } from 'lucide-react-native';
import { Linking, Modal, Pressable, Text, View } from 'react-native';
import WebView from 'react-native-webview';
import type { Exercise } from '@fittrack/shared';
import { colors } from '@fittrack/shared';

export default function ExerciseVideoModal({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
        <View className="rounded-2xl p-4 w-full" style={{ backgroundColor: colors.chartSurface }}>
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1 min-w-0 mr-2">
              <Text className="font-semibold" style={{ color: colors.textPrimary }} numberOfLines={1}>
                {exercise.name}
              </Text>
              <Text className="text-xs" style={{ color: colors.textMuted }}>
                {exercise.equipment} {exercise.sets && exercise.reps ? `· ${exercise.sets} × ${exercise.reps}` : exercise.notes ? `· ${exercise.notes}` : ''}
              </Text>
            </View>
            <Pressable onPress={onClose} className="p-1">
              <X size={18} color={colors.textPrimary} />
            </Pressable>
          </View>

          {exercise.videoId ? (
            <View className="rounded-xl overflow-hidden bg-black" style={{ aspectRatio: 16 / 9 }}>
              <WebView
                source={{ uri: `https://www.youtube-nocookie.com/embed/${exercise.videoId}?rel=0` }}
                allowsFullscreenVideo
                style={{ flex: 1, backgroundColor: 'black' }}
              />
            </View>
          ) : (
            <View className="rounded-xl p-6 items-center" style={{ backgroundColor: colors.background }}>
              <Text className="text-sm text-center" style={{ color: colors.textSecondary }}>
                No verified in-app video yet for this exercise — search YouTube instead.
              </Text>
            </View>
          )}

          <Pressable
            onPress={() => exercise.videoUrl && Linking.openURL(exercise.videoUrl)}
            className="flex-row items-center justify-center gap-1.5 mt-3 py-2"
          >
            <ExternalLink size={14} color={colors.brandPrimary} />
            <Text className="text-sm" style={{ color: colors.brandPrimary }}>
              {exercise.videoId ? 'More videos on YouTube' : 'Search YouTube'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
