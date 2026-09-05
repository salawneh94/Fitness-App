import { CloudOff, RefreshCw, TriangleAlert } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { colors } from '@fittrack/shared';
import { SYNC_FAILURE_THRESHOLD, useSyncQueue } from '@/lib/sync-queue';
import PressableScale from '@/components/ui/pressable-scale';

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * Tells the user when their data is *not* where they think it is.
 *
 * Cross-device sync is part of what the subscription buys, and until now a failing queue looked
 * exactly like a working one — a user whose writes were being rejected (expired session, an RLS
 * policy that doesn't do what we think) would only find out by reinstalling and losing the
 * queue with it. This renders nothing in the normal case; it appears only when there is
 * genuinely something to say.
 */
export default function SyncStatusBanner() {
  const pending = useSyncQueue((s) => s.pendingOps.length);
  const failures = useSyncQueue((s) => s.consecutiveFailures);
  const online = useSyncQueue((s) => s.online);
  const flush = useSyncQueue((s) => s.flush);

  // Nothing queued means nothing to warn about, even while offline — an offline app with all
  // its writes already pushed is in a perfectly good state and saying so is just noise.
  if (pending === 0) return null;

  const failing = failures >= SYNC_FAILURE_THRESHOLD;
  if (!failing && online) return null; // a normal in-flight flush; the Profile line covers it

  const changes = `${pending} ${pending === 1 ? 'change' : 'changes'}`;

  return (
    <View
      className="flex-row items-start gap-3 p-4 rounded-2xl border"
      style={{
        backgroundColor: failing ? 'rgba(248,113,113,0.10)' : 'rgba(148,163,184,0.10)',
        borderColor: failing ? colors.statusCritical : colors.gridline,
      }}
    >
      {failing ? (
        <TriangleAlert size={18} color={colors.statusCritical} style={{ marginTop: 2 }} />
      ) : (
        <CloudOff size={18} color={colors.textSecondary} style={{ marginTop: 2 }} />
      )}
      <View className="flex-1">
        <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
          {failing ? "Your changes aren't syncing" : 'Offline'}
        </Text>
        <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
          {failing
            ? `${changes} couldn't be saved to your account. They're kept on this device — don't reinstall until this clears.`
            : `${changes} saved on this device. ${pending === 1 ? 'It syncs' : 'They sync'} as soon as you're back online.`}
        </Text>
      </View>
      {failing && (
        <PressableScale onPress={() => void flush()} hapticStyle="selection" className="p-1" accessibilityLabel="Retry sync">
          <RefreshCw size={16} color={colors.statusCritical} />
        </PressableScale>
      )}
    </View>
  );
}

/** The always-visible counterpart, for the Profile screen: says where things stand either way. */
export function SyncStatusLine() {
  const pending = useSyncQueue((s) => s.pendingOps.length);
  const lastSyncedAt = useSyncQueue((s) => s.lastSyncedAt);
  const lastError = useSyncQueue((s) => s.lastError);
  const failures = useSyncQueue((s) => s.consecutiveFailures);

  const synced = pending === 0;
  return (
    <View>
      <Text className="text-sm" style={{ color: colors.textSecondary }}>
        {synced
          ? lastSyncedAt
            ? `All changes synced · ${relativeTime(lastSyncedAt)}`
            : 'All changes synced'
          : `${pending} ${pending === 1 ? 'change' : 'changes'} waiting to sync`}
      </Text>
      {failures >= SYNC_FAILURE_THRESHOLD && lastError && (
        <Text className="text-xs mt-1" style={{ color: colors.statusCritical }}>
          Last error: {lastError}
        </Text>
      )}
    </View>
  );
}
