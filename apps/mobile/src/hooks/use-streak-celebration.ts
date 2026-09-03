import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const MILESTONES = [3, 7, 14, 21, 30, 60, 100, 150, 200, 365];
const STORAGE_KEY = 'fittrack-last-celebrated-streak';

/** Fires a one-time celebration the first time the streak reaches a new milestone. */
export function useStreakCelebration(streak: number): boolean {
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (!MILESTONES.includes(streak)) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    (async () => {
      let last = 0;
      try {
        last = Number((await AsyncStorage.getItem(STORAGE_KEY)) ?? '0');
      } catch {
        // treat as never celebrated
      }
      if (cancelled || streak <= last) return;

      try {
        await AsyncStorage.setItem(STORAGE_KEY, String(streak));
      } catch {
        // celebration still plays this once even if it can't be remembered
      }
      if (cancelled) return;
      setCelebrating(true);
      timeout = setTimeout(() => setCelebrating(false), 2600);
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [streak]);

  return celebrating;
}
