import { useMemo } from 'react';
import { weeklyRecap, type WeeklyRecap } from '@fittrack/shared';
import { useAppStore } from '@/store/useAppStore';
import { useAdaptiveTargets } from './use-adaptive-targets';

/** The recap for the week starting `weekStart` (a Monday), built from everything in the store. */
export function useWeeklyRecap(weekStart: string): WeeklyRecap | null {
  const profile = useAppStore((s) => s.profile);
  const schedule = useAppStore((s) => s.scheduledWorkouts);
  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const foodEntries = useAppStore((s) => s.foodEntries);
  const weights = useAppStore((s) => s.weightHistory);
  const { targets } = useAdaptiveTargets(profile!);

  return useMemo(() => {
    if (!profile) return null;
    return weeklyRecap({ profile, schedule, workoutLogs, foodEntries, weights, targets, weekStart });
  }, [profile, schedule, workoutLogs, foodEntries, weights, targets, weekStart]);
}
