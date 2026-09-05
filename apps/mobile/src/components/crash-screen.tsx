import { useState } from 'react';
import { AlertTriangle } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ErrorBoundaryProps } from 'expo-router';
import { colors } from '@fittrack/shared';
import { useSyncQueue } from '@/lib/sync-queue';
import PressableScale from '@/components/ui/pressable-scale';

/**
 * What the user sees when a render throws.
 *
 * Without a boundary a single bad render is a white screen with no way out and no signal that
 * anything went wrong — the worst possible failure for an app someone is paying for. Retry
 * re-renders the subtree, which is enough for a transient failure (a half-written record, a
 * value that was briefly undefined mid-sync).
 *
 * The reassurance about data is load-bearing, not filler: a crash right after logging
 * something looks exactly like data loss from the outside, and the local store is written
 * before the crash and the queue survives it. Saying so stops people reinstalling — which
 * would be the one action that actually could lose the queue.
 */
export default function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  const pending = useSyncQueue((s) => s.pendingOps.length);
  const [details, setDetails] = useState(false);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-1 px-6 justify-center">
        <View className="items-center mb-6">
          <View
            className="w-14 h-14 rounded-2xl items-center justify-center mb-4"
            style={{ backgroundColor: 'rgba(248,113,113,0.15)' }}
          >
            <AlertTriangle size={26} color={colors.statusCritical} />
          </View>
          <Text className="text-xl font-bold text-center" style={{ color: colors.textPrimary }}>
            Something went wrong
          </Text>
          <Text className="text-sm text-center mt-2" style={{ color: colors.textSecondary }}>
            FitTrack hit an unexpected error on this screen.
            {pending > 0
              ? ` Your data is safe — ${pending} ${pending === 1 ? 'change is' : 'changes are'} still queued and will sync once you're back in.`
              : ' Your data is safe.'}
          </Text>
        </View>

        <PressableScale
          onPress={retry}
          hapticStyle="success"
          className="w-full py-3.5 rounded-full items-center"
          style={{ backgroundColor: colors.brandPrimaryDark }}
        >
          <Text className="text-white font-semibold">Try Again</Text>
        </PressableScale>

        <PressableScale onPress={() => setDetails((d) => !d)} hapticStyle="selection" className="items-center py-3 mt-1">
          <Text className="text-xs underline" style={{ color: colors.textMuted }}>
            {details ? 'Hide details' : 'Show details'}
          </Text>
        </PressableScale>

        {details && (
          <ScrollView
            className="rounded-xl border p-3 mt-1"
            style={{ borderColor: colors.gridline, maxHeight: 220 }}
          >
            <Text className="text-xs" style={{ color: colors.textMuted }}>
              {error.message}
              {error.stack ? `\n\n${error.stack}` : ''}
            </Text>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
