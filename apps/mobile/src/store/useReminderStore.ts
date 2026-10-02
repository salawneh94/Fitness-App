import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { refreshStreakReminder, refreshWeeklyRecap, requestReminderPermission } from '@/lib/notifications';

interface ReminderState {
  enabled: boolean;
  hour: number;
  minute: number;
  /** The Sunday-evening recap — its own opt-in, separate from the daily reminder. */
  weeklyRecap: boolean;
  setWeeklyRecap: (enabled: boolean) => Promise<boolean>;
  /** Turn the reminder on (asking for permission first) or off. Returns the resulting state. */
  setEnabled: (enabled: boolean) => Promise<boolean>;
  setTime: (hour: number, minute: number) => Promise<void>;
  /** Re-evaluate what should be scheduled — safe to call often. */
  refresh: () => Promise<void>;
}

/** Evening, late enough that a normal day is over but early enough to act on. */
const DEFAULT_HOUR = 20;

export const useReminderStore = create<ReminderState>()(
  persist(
    (set, get) => ({
      // Off by default. A fitness app that starts notifying without being asked is one the user
      // silences in week one, which costs the reminder that would actually have helped later.
      enabled: false,
      hour: DEFAULT_HOUR,
      minute: 0,
      weeklyRecap: false,

      setWeeklyRecap: async (enabled) => {
        const granted = enabled ? await requestReminderPermission() : false;
        set({ weeklyRecap: granted });
        await refreshWeeklyRecap(granted);
        return granted;
      },

      setEnabled: async (enabled) => {
        if (!enabled) {
          set({ enabled: false });
          await refreshStreakReminder({ enabled: false, hour: get().hour, minute: get().minute });
          return false;
        }
        const granted = await requestReminderPermission();
        set({ enabled: granted });
        await refreshStreakReminder({ enabled: granted, hour: get().hour, minute: get().minute });
        return granted;
      },

      setTime: async (hour, minute) => {
        set({ hour, minute });
        await refreshStreakReminder({ enabled: get().enabled, hour, minute });
      },

      refresh: async () => {
        const { enabled, hour, minute, weeklyRecap } = get();
        await refreshStreakReminder({ enabled, hour, minute });
        await refreshWeeklyRecap(weeklyRecap);
      },
    }),
    {
      name: 'fittrack-reminders',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ enabled: s.enabled, hour: s.hour, minute: s.minute, weeklyRecap: s.weeklyRecap }),
      // Re-arm on rehydrate: a device that was rebooted has lost its scheduled notification, and
      // the stored preference is the only record that one was wanted.
      onRehydrateStorage: () => (state) => {
        void state?.refresh();
      },
    }
  )
);
