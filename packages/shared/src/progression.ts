import type { Exercise, ExerciseLogEntry, SetEntry, WorkoutLogEntry } from './types';

/**
 * Smallest weight step that's actually available for a kind of equipment.
 *
 * "Add 2.5kg" is useless advice if the gym's dumbbells jump in 4s. These are the real-world
 * increments: the smallest pair of plates for a barbell, a rack step for dumbbells, and the
 * genuinely coarse jumps kettlebells come in.
 */
const INCREMENT_KG = {
  barbell: 2.5,
  dumbbell: 2,
  kettlebell: 4,
  machine: 2.5,
  bodyweight: 0,
} as const;

export function incrementForEquipment(equipment: string): number {
  const e = equipment.toLowerCase();
  // Checked before bodyweight because several entries read "Bodyweight/Barbell" — if a bar can
  // be loaded, weight is the progression that matters.
  if (e.includes('barbell') || e.includes('ez-bar') || e.includes('t-bar') || e.includes('plate')) {
    return INCREMENT_KG.barbell;
  }
  if (e.includes('kettlebell')) return INCREMENT_KG.kettlebell;
  if (e.includes('dumbbell')) return INCREMENT_KG.dumbbell;
  if (e.includes('machine') || e.includes('cable') || e.includes('band')) return INCREMENT_KG.machine;
  return INCREMENT_KG.bodyweight;
}

export interface RepRange {
  min: number;
  max: number;
}

/**
 * Read the rep target off an exercise's `reps` string.
 *
 * The library writes these for humans, not parsers: "6-10", "10-12/leg", "10/side", "20 total",
 * "30-60s". Everything but the time-based ones is a rep count, and a hold measured in seconds is
 * not something weight progression applies to — so those return null and the caller leaves them
 * alone rather than inventing a target.
 */
export function parseRepRange(reps: string | undefined): RepRange | null {
  if (!reps) return null;
  // A digit followed by "s" that isn't the start of a word ("30s", "20-30 s") means seconds.
  // "/side" must not match: there the s begins a word.
  if (/\d\s*s(?![a-z])/i.test(reps)) return null;

  const numbers = reps.match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;

  const min = Number(numbers[0]);
  const max = numbers.length > 1 ? Number(numbers[1]) : min;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0) return null;
  return { min, max: Math.max(min, max) };
}

export interface LastPerformance {
  date: string;
  log: ExerciseLogEntry;
}

/** The most recent session that actually recorded sets for this exercise. */
export function lastPerformance(logs: WorkoutLogEntry[], exerciseId: string): LastPerformance | null {
  let best: LastPerformance | null = null;
  for (const workout of logs) {
    const log = workout.exerciseLogs?.find((e) => e.exerciseId === exerciseId && e.sets.length > 0);
    if (!log) continue;
    if (!best || workout.date > best.date) best = { date: workout.date, log };
  }
  return best;
}

export type ProgressionAction = 'increase_weight' | 'add_reps' | 'hold';

export interface LoadSuggestion {
  /** Weight to put on the bar next session. */
  weightKg: number;
  /** Reps to aim for on every set at that weight. */
  targetReps: number;
  action: ProgressionAction;
  /** The step being added, when the action is to add weight. */
  incrementKg: number;
  /** What was done last time, for the UI to show alongside the suggestion. */
  previous: { weightKg: number; reps: number[] };
  /**
   * Consecutive recent sessions at this same top weight. Two or more without earning the jump
   * is the signal a lift has stalled — the point at which the honest advice stops being
   * "add reps" and starts being "this needs a change".
   */
  sessionsAtWeight: number;
}

function topWeight(sets: SetEntry[]): number {
  return sets.reduce((max, s) => Math.max(max, s.weightKg), 0);
}

/**
 * Double progression: earn the reps at a weight, then earn the weight.
 *
 * This is the mechanism by which lifting actually works, and until now the app logged every set,
 * rep and kilo the user lifted and did nothing with them but draw a chart — leaving the single
 * question anyone has when they walk up to a bar ("what should I put on it?") unanswered.
 *
 * Hitting the top of the rep range on every set earns the next weight, and reps reset to the
 * bottom of the range. Short of that, the weight stays and the target is one more rep than the
 * weakest set managed — progress that's small enough to actually make, which is the point.
 */
export function suggestNextLoad(
  performance: LastPerformance,
  exercise: Pick<Exercise, 'equipment' | 'reps'>,
  history: WorkoutLogEntry[] = []
): LoadSuggestion | null {
  const range = parseRepRange(exercise.reps);
  if (!range) return null; // timed holds and the like have nothing to progress

  const sets = performance.log.sets;
  if (sets.length === 0) return null;

  const weight = topWeight(sets);
  const reps = sets.map((s) => s.reps);
  const increment = incrementForEquipment(exercise.equipment);
  const previous = { weightKg: weight, reps };

  // How long they've been stuck here, counting back while the top weight is unchanged.
  const sameWeightSessions = history
    .filter((w) => w.exerciseLogs?.some((e) => e.exerciseId === performance.log.exerciseId))
    .sort((a, b) => b.date.localeCompare(a.date));
  let sessionsAtWeight = 0;
  for (const workout of sameWeightSessions) {
    const log = workout.exerciseLogs!.find((e) => e.exerciseId === performance.log.exerciseId)!;
    if (log.sets.length === 0 || topWeight(log.sets) !== weight) break;
    sessionsAtWeight += 1;
  }
  sessionsAtWeight = Math.max(1, sessionsAtWeight);

  const everySetAtTop = reps.every((r) => r >= range.max);

  if (everySetAtTop && increment > 0) {
    return {
      weightKg: weight + increment,
      targetReps: range.min,
      action: 'increase_weight',
      incrementKg: increment,
      previous,
      sessionsAtWeight,
    };
  }

  if (everySetAtTop) {
    // Bodyweight work with no load to add — the rep range is already topped out, so holding is
    // the honest answer rather than inventing a weight the user doesn't have.
    return { weightKg: weight, targetReps: range.max, action: 'hold', incrementKg: 0, previous, sessionsAtWeight };
  }

  const weakest = Math.min(...reps);
  return {
    weightKg: weight,
    targetReps: Math.min(range.max, weakest + 1),
    action: 'add_reps',
    incrementKg: increment,
    previous,
    sessionsAtWeight,
  };
}
