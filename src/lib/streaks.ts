import type { FoodEntry, WorkoutLogEntry } from '../types';
import { addDaysISO, todayISO } from './calc';

const addDays = addDaysISO;

// Nothing here should ever walk more than a few years of days. If a cursor somehow stops
// advancing, stop rather than spinning the main thread — an infinite loop here freezes the
// whole tab (no scrolling, no taps), which is far worse than a slightly wrong streak count.
const MAX_DAYS_SCANNED = 20000;

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
  while (active.has(cursor) && currentStreak < MAX_DAYS_SCANNED) {
    currentStreak++;
    cursor = addDays(cursor, -1);
  }

  // Best streak: scan every date between `since` and today.
  let bestStreak = 0;
  let running = 0;
  let d = since;
  for (let scanned = 0; d <= today && scanned < MAX_DAYS_SCANNED; scanned++) {
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
  while (trainedDays.has(cursor) && consecutive < MAX_DAYS_SCANNED) {
    consecutive++;
    cursor = addDays(cursor, -1);
  }
  return { consecutiveTrainedDays: consecutive, shouldRest: consecutive >= 6 };
}
