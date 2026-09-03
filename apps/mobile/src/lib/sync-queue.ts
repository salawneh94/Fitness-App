import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
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
  enqueue: (op: SyncOp) => void;
  flush: () => Promise<void>;
}

let flushing = false;

export const useSyncQueue = create<SyncQueueState>()(
  persist(
    (set, get) => ({
      pendingOps: [],

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
          const net = await NetInfo.fetch();
          if (net.isConnected === false) return;

          // Process a snapshot in order; stop at the first failure so ordering is preserved
          // for the next attempt (a later op for the same key already replaced any earlier one).
          const ops = get().pendingOps;
          for (const currentOp of ops) {
            const stillQueued = get().pendingOps.find((o) => o.key === currentOp.key);
            if (!stillQueued) continue; // superseded or already flushed

            const { error } =
              stillQueued.op === 'upsert'
                ? await supabase.from(stillQueued.table).upsert(stillQueued.row!)
                : await supabase.from(stillQueued.table).delete().match(stillQueued.match!);

            if (error) return; // network/server issue — leave the rest queued, retry later

            set((state) => ({ pendingOps: state.pendingOps.filter((o) => o.key !== stillQueued.key) }));
          }
        } finally {
          flushing = false;
        }
      },
    }),
    {
      name: 'fitness-app-sync-queue',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

NetInfo.addEventListener((state) => {
  if (state.isConnected) void useSyncQueue.getState().flush();
});
