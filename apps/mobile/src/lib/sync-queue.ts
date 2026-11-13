import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { supabase } from './supabase';
import { onSignOut, useAuthStore } from '@/store/useAuthStore';

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
  | 'progress_photos'
  | 'water_entries';

/**
 * The unique key each upsert must resolve conflicts on, for tables where that isn't the primary key.
 *
 * PostgREST upserts on the primary key unless told otherwise, and these rows never carry one —
 * they're identified by (user, day), with `id` left to the database's default. So without this
 * the second write for a day (correcting a weight, re-applying a plan) inserted a fresh id and hit
 * the (user_id, date) unique constraint. That failure is permanent, and flush stops at the first
 * failure to preserve ordering — so one corrected weigh-in silently blocked every write queued
 * after it, for good. Reproduced against the real migrations in Postgres.
 */
const CONFLICT_TARGET: Partial<Record<SyncTable, string>> = {
  weight_entries: 'user_id,date',
  steps_entries: 'user_id,date',
  sleep_entries: 'user_id,date',
  body_measurements: 'user_id,date',
  water_entries: 'user_id,date',
  scheduled_workouts: 'user_id,day',
};

export interface SyncOp {
  /** table + key uniquely identifies an op; a newer enqueue for the same key replaces the older one. */
  key: string;
  table: SyncTable;
  op: 'upsert' | 'delete';
  /** The full row (snake_case, ready for supabase.from(table).upsert), only present for 'upsert'. */
  row?: Record<string, unknown>;
  /** The row id/match column(s) to delete by, only present for 'delete'. */
  match?: Record<string, unknown>;
  /**
   * Whose write this is. A queue outlives a sign-out (it has to: writes made offline must survive
   * until they can be sent), so on a shared phone it can hold one person's writes while another is
   * signed in. Sending those under the wrong session gets them refused; they wait for their owner.
   * Absent only on ops queued before this field existed, which are treated as the current user's.
   */
  userId?: string;
}

/** A write the server refused outright, kept rather than discarded. */
export interface RejectedOp extends SyncOp {
  /** What the server said. */
  error: string;
  rejectedAt: string;
}

/**
 * Is this failure one that trying again could fix?
 *
 * No response at all (offline, DNS, a timeout) and the statuses that mean "not now" — an expired
 * session, rate limiting, a server having a bad minute — are worth retrying. Everything else in
 * the 4xx range is the server understanding the request and saying no: a constraint, a policy, a
 * column or table that isn't there. That answer won't change by asking again, so retrying it at
 * the head of an ordered queue is how one bad row used to block every write behind it for good.
 */
export function isRetryable(status: number | undefined): boolean {
  if (!status) return true;
  if (status === 401 || status === 408 || status === 425 || status === 429) return true;
  return status >= 500;
}

const mine = (op: SyncOp, userId: string | null) => !op.userId || op.userId === userId;
const currentUserId = () => useAuthStore.getState().session?.user.id ?? null;

/** The signed-in user's unsent writes, queued and refused alike — never another account's. */
export function unsentOps(): SyncOp[] {
  const userId = currentUserId();
  const { pendingOps, rejectedOps } = useSyncQueue.getState();
  return [...pendingOps, ...rejectedOps].filter((o) => mine(o, userId));
}

/** How many of these writes belong to the signed-in user — what the status UI should count. */
export function countMine(ops: SyncOp[], userId: string | null): number {
  return ops.filter((o) => mine(o, userId)).length;
}

interface SyncQueueState {
  pendingOps: SyncOp[];
  /**
   * Writes the server refused. They no longer block the queue, but they're the user's data, so
   * they aren't thrown away: each is offered to the server again once per app start (the usual
   * cause — a missing migration, a policy bug — gets fixed server-side), and a newer write to the
   * same row replaces it.
   */
  rejectedOps: RejectedOp[];
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
  /** Put the refused writes back in the queue and try them again now. */
  retryRejected: () => Promise<void>;
  /** Drops every pending op without pushing it — e.g. after the account they'd sync to no longer
   * exists, where flushing would just retry against rows that were already cascade-deleted. */
  clear: () => void;
}

/** Consecutive failures before we tell the user something is actually wrong. */
export const SYNC_FAILURE_THRESHOLD = 3;

let flushing = false;
/** Refused writes get one automatic second chance per app start, on its first flush. */
let offeredRejectedThisSession = false;

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
      rejectedOps: [],
      lastSyncedAt: null,
      consecutiveFailures: 0,
      lastError: null,
      online: true,

      enqueue: (op) => {
        const owned = { ...op, userId: op.userId ?? currentUserId() ?? undefined };
        // Same row, same owner: the newer write replaces the older, queued or refused alike.
        const sameRow = (existing: SyncOp) => existing.key === owned.key && (existing.userId ?? owned.userId) === owned.userId;
        set((state) => ({
          pendingOps: [...state.pendingOps.filter((existing) => !sameRow(existing)), owned],
          rejectedOps: state.rejectedOps.filter((existing) => !sameRow(existing)),
        }));
        void get().flush();
      },

      retryRejected: async () => {
        set((state) => ({
          pendingOps: [...state.pendingOps, ...state.rejectedOps.map(({ error: _error, rejectedAt: _rejectedAt, ...op }) => op)],
          rejectedOps: [],
        }));
        await get().flush();
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

          // Writes are sent as whoever is signed in, so with nobody signed in there is nothing
          // that can be sent — and anything queued by someone else waits for them.
          const userId = currentUserId();
          if (!userId) return;

          if (!offeredRejectedThisSession) {
            offeredRejectedThisSession = true;
            const again = get().rejectedOps.filter((o) => mine(o, userId));
            if (again.length > 0) {
              set((state) => ({
                pendingOps: [...state.pendingOps, ...again.map(({ error: _error, rejectedAt: _rejectedAt, ...op }) => op)],
                rejectedOps: state.rejectedOps.filter((o) => !mine(o, userId)),
              }));
            }
          }

          // Send in order, always taking the next write from the live queue rather than from a
          // snapshot: a write queued while a request is in flight (a second tap on the water
          // button, an edit straight after a save) is picked up by this same pass. Stop at the
          // first failure that might pass later, so ordering is preserved for the next attempt.
          const attempted = new Set<SyncOp>();
          for (;;) {
            const stillQueued = get().pendingOps.find((o) => mine(o, userId) && !attempted.has(o));
            if (!stillQueued) break;
            attempted.add(stillQueued);

            // A request that throws (rather than resolving with an error) has to count as a
            // failure too, or the whole class of DNS/TLS/unexpected exceptions escapes flush()
            // without ever incrementing the counter — invisible again, which is the bug this
            // status work exists to remove.
            const { error, status } = await withTimeout(
              (stillQueued.op === 'upsert'
                ? supabase
                    .from(stillQueued.table)
                    .upsert(stillQueued.row!, { onConflict: CONFLICT_TARGET[stillQueued.table] })
                : supabase.from(stillQueued.table).delete().match(stillQueued.match!)
              ).then(
                (result) => ({ error: result.error as { message: string } | null, status: result.status as number | undefined }),
                (thrown: unknown) => ({
                  error: { message: thrown instanceof Error ? thrown.message : String(thrown) },
                  status: undefined as number | undefined,
                })
              ),
              REQUEST_TIMEOUT_MS,
              { error: { message: 'Request timed out' }, status: undefined }
            );

            if (error && !isRetryable(status)) {
              // The server said no and will keep saying no. Set this write aside and carry on:
              // it must not cost the user every write queued behind it.
              set((state) => ({
                pendingOps: state.pendingOps.filter((o) => o !== stillQueued),
                rejectedOps: [...state.rejectedOps, { ...stillQueued, error: error.message, rejectedAt: new Date().toISOString() }],
                lastError: error.message,
              }));
              continue;
            }

            if (error) {
              // Network/server issue — leave this op and the rest queued and retry later, but
              // record it so the UI can stop pretending everything is fine.
              set((state) => ({
                consecutiveFailures: state.consecutiveFailures + 1,
                lastError: error.message,
              }));
              return;
            }

            // Remove exactly the write that was sent, by identity. Removing "whatever is queued
            // for this row" also threw away a newer write for the same row that arrived while
            // this one was in flight — leaving the server on the older value with nothing left
            // queued to correct it.
            set((state) => ({
              pendingOps: state.pendingOps.filter((o) => o !== stillQueued),
              consecutiveFailures: 0,
              lastError: null,
            }));
          }

          // Only claim a sync once everything of this user's actually reached the server — a
          // partial flush is not "synced", and neither is one that left a write refused.
          const { pendingOps, rejectedOps } = get();
          if (![...pendingOps, ...rejectedOps].some((o) => mine(o, userId))) set({ lastSyncedAt: new Date().toISOString() });
        } finally {
          flushing = false;
        }
      },

      clear: () => set({ pendingOps: [], rejectedOps: [], consecutiveFailures: 0, lastError: null }),
    }),
    {
      name: 'fitness-app-sync-queue',
      storage: createJSONStorage(() => AsyncStorage),
      // Failure counters and connectivity describe this run, not durable state — a restart
      // should re-derive them rather than resurrect a stale warning.
      partialize: (state) => ({ pendingOps: state.pendingOps, rejectedOps: state.rejectedOps, lastSyncedAt: state.lastSyncedAt }),
    }
  )
);

// A last attempt to send what's queued while the session that owns it still exists. Bounded: with
// no connection this must not hold the sign-out up. Whatever doesn't make it stays queued under
// its owner and goes out the next time they sign in on this device.
const SIGN_OUT_FLUSH_MS = 4_000;
onSignOut('before', () => withTimeout(useSyncQueue.getState().flush(), SIGN_OUT_FLUSH_MS, undefined));

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
