import { CloudOff, RefreshCw, TriangleAlert } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { colors } from '@fittrack/shared';
import { SYNC_FAILURE_THRESHOLD, countMine, useSyncQueue } from '@/lib/sync-queue';
import { useAuthStore } from '@/store/useAuthStore';
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
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const pending = useSyncQueue((s) => countMine(s.pendingOps, userId));
  const rejected = useSyncQueue((s) => countMine(s.rejectedOps, userId));
  const failures = useSyncQueue((s) => s.consecutiveFailures);
  const online = useSyncQueue((s) => s.online);
  const flush = useSyncQueue((s) => s.flush);
  const retryRejected = useSyncQueue((s) => s.retryRejected);

  // A write the server refused is the one case where waiting won't help, so it's said outright
  // rather than folded into "not syncing": everything else did sync, this didn't, and it's safe.
  if (rejected > 0) {
    return (
      <View
        className="flex-row items-start gap-3 p-4 rounded-2xl border"
        style={{ backgroundColor: 'rgba(251,191,36,0.10)', borderColor: colors.statusWarning }}
      >
        <TriangleAlert size={18} color={colors.statusWarning} style={{ marginTop: 2 }} />
        <View className="flex-1">
          <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
            {rejected} {rejected === 1 ? 'change wasn’t' : 'changes weren’t'} accepted by the server
          </Text>
          <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
            {rejected === 1 ? 'It’s' : 'They’re'} kept on this device and will be tried again each time the app starts. Everything else is
            syncing normally.
          </Text>
        </View>
        <PressableScale onPress={() => void retryRejected()} hapticStyle="selection" className="p-1" accessibilityLabel="Try refused changes again">
          <RefreshCw size={16} color={colors.statusWarning} />
        </PressableScale>
      </View>
    );
  }

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
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const pending = useSyncQueue((s) => countMine(s.pendingOps, userId));
  const rejected = useSyncQueue((s) => countMine(s.rejectedOps, userId));
  const rejectedReason = useSyncQueue((s) => s.rejectedOps.find((o) => !o.userId || o.userId === userId)?.error);
  const lastSyncedAt = useSyncQueue((s) => s.lastSyncedAt);
  const lastError = useSyncQueue((s) => s.lastError);
  const failures = useSyncQueue((s) => s.consecutiveFailures);

  const synced = pending === 0 && rejected === 0;
  return (
    <View>
      <Text className="text-sm" style={{ color: colors.textSecondary }}>
        {synced
          ? lastSyncedAt
            ? `All changes synced · ${relativeTime(lastSyncedAt)}`
            : 'All changes synced'
          : pending > 0
            ? `${pending} ${pending === 1 ? 'change' : 'changes'} waiting to sync`
            : 'Everything else is synced'}
      </Text>
      {rejected > 0 && (
        <Text className="text-xs mt-1" style={{ color: colors.statusWarning }}>
          {rejected} {rejected === 1 ? 'change wasn’t' : 'changes weren’t'} accepted by the server
          {rejectedReason ? `: ${rejectedReason}` : ''}. Kept on this device.
        </Text>
      )}
      {failures >= SYNC_FAILURE_THRESHOLD && lastError && (
        <Text className="text-xs mt-1" style={{ color: colors.statusCritical }}>
          Last error: {lastError}
        </Text>
      )}
    </View>
  );
}
