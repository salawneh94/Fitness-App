import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { computeStreaks, todayISO } from '@fittrack/shared';
import { useAppStore } from '@/store/useAppStore';

const REMINDER_CATEGORY = 'streak-reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** True once the user has logged anything at all today — food or a workout. */
export function loggedToday(): boolean {
  const { foodEntries, workoutLogs } = useAppStore.getState();
  const today = todayISO();
  return foodEntries.some((f) => f.date === today) || workoutLogs.some((w) => w.date === today);
}

export async function requestReminderPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REMINDER_CATEGORY, {
    name: 'Daily reminder',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
  });
}

export async function cancelReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Re-arm the one reminder that's currently worth sending.
 *
 * Deliberately not a repeating daily trigger. A repeat fires on a schedule the app can't
 * reconsider, so it would tell someone who already logged an hour ago to go and log — which is
 * exactly the notification that gets an app muted, and muted notifications protect no streaks.
 *
 * Instead this schedules a single dated notification and is re-run whenever the answer could
 * have changed (app foreground, after a log, when the setting changes). If today is already
 * logged, tonight's reminder is dropped and tomorrow's is queued in its place.
 */
export async function refreshStreakReminder(options: {
  enabled: boolean;
  hour: number;
  minute: number;
}): Promise<void> {
  if (Platform.OS === 'web') return;

  await cancelReminders();
  if (!options.enabled) return;

  const permitted = (await Notifications.getPermissionsAsync()).granted;
  if (!permitted) return;

  await ensureAndroidChannel();

  const now = new Date();
  const target = new Date(now);
  target.setHours(options.hour, options.minute, 0, 0);

  // Today's slot is only useful if it hasn't passed and there's still nothing logged.
  if (target <= now || loggedToday()) {
    target.setDate(target.getDate() + 1);
  }

  const { profile, foodEntries, workoutLogs } = useAppStore.getState();
  const streak = profile
    ? computeStreaks(foodEntries, workoutLogs, profile.createdAt.slice(0, 10)).currentStreak
    : 0;

  // A streak worth protecting is the whole reason to send this; without one, don't pretend.
  const body =
    streak >= 2
      ? `You're on a ${streak}-day streak. A quick log keeps it alive.`
      : 'Log today to keep your progress moving.';

  await Notifications.scheduleNotificationAsync({
    content: { title: 'FitTrack', body, categoryIdentifier: REMINDER_CATEGORY },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: target,
      channelId: Platform.OS === 'android' ? REMINDER_CATEGORY : undefined,
    },
  });
}
