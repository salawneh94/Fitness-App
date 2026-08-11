import type { FoodEntry, WorkoutLogEntry } from '../types';
import { todayISO } from './calc';

function addDays(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function activeDaySet(foodEntries: FoodEntry[], workoutLogs: WorkoutLogEntry[]): Set<string> {
  const days = new Set<string>();
  for (const f of foodEntries) days.add(f.date);
  for (const w of workoutLogs) days.add(w.date);
  return days;
}

export interface StreakStats {
  currentStreak: number;
  bestStreak: number;
  adherence7d: number; // 0-1
  adherence30d: number; // 0-1
  activeDaysTotal: number;
}

export function computeStreaks(
  foodEntries: FoodEntry[],
  workoutLogs: WorkoutLogEntry[],
  since: string
): StreakStats {
  const active = activeDaySet(foodEntries, workoutLogs);
  const today = todayISO();

  // Current streak: walk backwards from today (allow today to be empty-in-progress —
  // start counting from yesterday if today has no activity yet).
  let currentStreak = 0;
  let cursor = active.has(today) ? today : addDays(today, -1);
  while (active.has(cursor)) {
    currentStreak++;
    cursor = addDays(cursor, -1);
  }

  // Best streak: scan every date between `since` and today.
  let bestStreak = 0;
  let running = 0;
  let d = since;
  while (d <= today) {
    if (active.has(d)) {
      running++;
      bestStreak = Math.max(bestStreak, running);
    } else {
      running = 0;
    }
    d = addDays(d, 1);
  }

  function adherence(windowDays: number): number {
    let count = 0;
    let total = 0;
    for (let i = 0; i < windowDays; i++) {
      const date = addDays(today, -i);
      if (date < since) break;
      total++;
      if (active.has(date)) count++;
    }
    return total > 0 ? count / total : 0;
  }

  return {
    currentStreak,
    bestStreak,
    adherence7d: adherence(7),
    adherence30d: adherence(30),
    activeDaysTotal: active.size,
  };
}

export interface RestDayInsight {
  consecutiveTrainedDays: number;
  shouldRest: boolean;
}

export function computeRestDayInsight(workoutLogs: WorkoutLogEntry[]): RestDayInsight {
  const trainedDays = new Set(workoutLogs.map((w) => w.date));
  const today = todayISO();
  let consecutive = 0;
  let cursor = trainedDays.has(today) ? today : addDays(today, -1);
  while (trainedDays.has(cursor)) {
    consecutive++;
    cursor = addDays(cursor, -1);
  }
  return { consecutiveTrainedDays: consecutive, shouldRest: consecutive >= 6 };
}
