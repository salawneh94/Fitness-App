import { useEffect, useState } from 'react';

const MILESTONES = [3, 7, 14, 21, 30, 60, 100, 150, 200, 365];
const STORAGE_KEY = 'fittrack-last-celebrated-streak';

/** Fires a one-time celebration the first time the streak reaches a new milestone. */
export function useStreakCelebration(streak: number): boolean {
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (!MILESTONES.includes(streak)) return;

    let last = 0;
    try {
      last = Number(localStorage.getItem(STORAGE_KEY) ?? '0');
    } catch {
      // localStorage unavailable — treat as never celebrated, still safe to skip persisting below
    }
    if (streak <= last) return;

    try {
      localStorage.setItem(STORAGE_KEY, String(streak));
    } catch {
      // ignore — celebration still plays this once even if it can't be remembered
    }
    setCelebrating(true);
    const timeout = setTimeout(() => setCelebrating(false), 2600);
    return () => clearTimeout(timeout);
  }, [streak]);

  return celebrating;
}
