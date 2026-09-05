import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { supabase } from './supabase';

export type SyncTable =
  | 'profiles'
  | 'weight_entries'
  | 'steps_entries'
  | 'sleep_entries'
  | 'body_measurements'
  | 'food_entries'
  | 'saved_meals'
  | 'scheduled_workouts'
  | 'workout_logs'
  | 'progress_photos';

export interface SyncOp {
  /** table + key uniquely identifies an op; a newer enqueue for the same key replaces the older one. */
  key: string;
  table: SyncTable;
  op: 'upsert' | 'delete';
  /** The full row (snake_case, ready for supabase.from(table).upsert), only present for 'upsert'. */
  row?: Record<string, unknown>;
  /** The row id/match column(s) to delete by, only present for 'delete'. */
  match?: Record<string, unknown>;
}

interface SyncQueueState {
  pendingOps: SyncOp[];
  /** ISO timestamp of the last flush that left the queue empty — i.e. everything local reached
   * the server. Null until that has happened at least once on this device. */
  lastSyncedAt: string | null;
  /** Failed flush attempts since the last successful write. Drives the "not syncing" warning:
   * one failure is normal (a tunnel, a dropped request), a run of them is not. */
  consecutiveFailures: number;
  /** Message from the most recent failure, for the Profile screen's detail line. */
  lastError: string | null;
  /** Last known connectivity. Starts optimistic so a banner doesn't flash before NetInfo
   * reports in. */
  online: boolean;
  enqueue: (op: SyncOp) => void;
  flush: () => Promise<void>;
  /** Drops every pending op without pushing it — e.g. after the account they'd sync to no longer
   * exists, where flushing would just retry against rows that were already cascade-deleted. */
  clear: () => void;
}

/** Consecutive failures before we tell the user something is actually wrong. */
export const SYNC_FAILURE_THRESHOLD = 3;

let flushing = false;

/**
 * Resolves to `fallback` if `promise` hasn't settled in `ms`.
 *
 * Every await inside flush() runs while the `flushing` guard is held, so anything that can hang
 * indefinitely wedges the queue for the rest of the app session — no write ever reaches the
 * server again until a restart, silently. NetInfo.fetch() does exactly that on web when its
 * reachability probe can't reach the network (observed here: the failure count froze because
 * the third flush never got past it), and a server request with no response is the same shape
 * of problem. Bounding both is what keeps a stall temporary instead of permanent.
 */
// Takes PromiseLike, not Promise: supabase-js query builders are thenables, not real Promises.
function withTimeout<T>(promise: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

const CONNECTIVITY_TIMEOUT_MS = 5_000;
const REQUEST_TIMEOUT_MS = 30_000;

export const useSyncQueue = create<SyncQueueState>()(
  persist(
    (set, get) => ({
      pendingOps: [],
      lastSyncedAt: null,
      consecutiveFailures: 0,
      lastError: null,
      online: true,

      enqueue: (op) => {
        set((state) => ({
          pendingOps: [...state.pendingOps.filter((existing) => existing.key !== op.key), op],
        }));
        void get().flush();
      },

      flush: async () => {
        if (flushing) return;
        flushing = true;
        try {
          // A connectivity check that never answers must not be able to block the flush; if it
          // doesn't come back in time, assume we're online and let the request itself decide.
          const net = await withTimeout(NetInfo.fetch(), CONNECTIVITY_TIMEOUT_MS, {
            isConnected: true,
          } as Awaited<ReturnType<typeof NetInfo.fetch>>);
          set({ online: net.isConnected !== false });
          // Being offline isn't a failure — it's an expected state with its own indicator, so
          // it must not count toward the "something is wrong" threshold.
          if (net.isConnected === false) return;

          // Process a snapshot in order; stop at the first failure so ordering is preserved
          // for the next attempt (a later op for the same key already replaced any earlier one).
          const ops = get().pendingOps;
          for (const currentOp of ops) {
            const stillQueued = get().pendingOps.find((o) => o.key === currentOp.key);
            if (!stillQueued) continue; // superseded or already flushed

            // A request that throws (rather than resolving with an error) has to count as a
            // failure too, or the whole class of DNS/TLS/unexpected exceptions escapes flush()
            // without ever incrementing the counter — invisible again, which is the bug this
            // status work exists to remove.
            const { error } = await withTimeout(
              (stillQueued.op === 'upsert'
                ? supabase.from(stillQueued.table).upsert(stillQueued.row!)
                : supabase.from(stillQueued.table).delete().match(stillQueued.match!)
              ).then(
                (result) => ({ error: result.error as { message: string } | null }),
                (thrown: unknown) => ({
                  error: { message: thrown instanceof Error ? thrown.message : String(thrown) },
                })
              ),
              REQUEST_TIMEOUT_MS,
              { error: { message: 'Request timed out' } }
            );

            if (error) {
              // Network/server issue — leave this op and the rest queued and retry later, but
              // record it so the UI can stop pretending everything is fine.
              set((state) => ({
                consecutiveFailures: state.consecutiveFailures + 1,
                lastError: error.message,
              }));
              return;
            }

            set((state) => ({
              pendingOps: state.pendingOps.filter((o) => o.key !== stillQueued.key),
              consecutiveFailures: 0,
              lastError: null,
            }));
          }

          // Only claim a sync once the queue actually drained — a partial flush is not "synced".
          if (get().pendingOps.length === 0) set({ lastSyncedAt: new Date().toISOString() });
        } finally {
          flushing = false;
        }
      },

      clear: () => set({ pendingOps: [], consecutiveFailures: 0, lastError: null }),
    }),
    {
      name: 'fitness-app-sync-queue',
      storage: createJSONStorage(() => AsyncStorage),
      // Failure counters and connectivity describe this run, not durable state — a restart
      // should re-derive them rather than resurrect a stale warning.
      partialize: (state) => ({ pendingOps: state.pendingOps, lastSyncedAt: state.lastSyncedAt }),
    }
  )
);

NetInfo.addEventListener((state) => {
  useSyncQueue.setState({ online: state.isConnected !== false });
  if (state.isConnected) void useSyncQueue.getState().flush();
});

// NetInfo's web implementation subscribes to navigator.connection's "change" event when that
// API exists, and only falls back to the window online/offline events when it doesn't. Chromium
// exposes navigator.connection but doesn't fire "change" on connectivity loss, so on web the
// listener above never hears about going offline. Bind the window events directly to cover it.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useSyncQueue.setState({ online: true });
    void useSyncQueue.getState().flush();
  });
  window.addEventListener('offline', () => useSyncQueue.setState({ online: false }));
}
