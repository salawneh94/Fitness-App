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

export type ProgressionAction = 'increase_weight' | 'add_reps' | 'hold' | 'deload';

/**
 * A planned step back on one lift, to break a plateau.
 *
 * It only ever changes one suggestion — the next session's — and needs no "end" of its own: once
 * a session is logged at any top weight other than `stalledKg`, the plateau is broken (or at
 * least changed), the deload no longer applies, and double progression builds back up from
 * whatever was actually lifted. Skip the deload and log the stalled weight again, and it simply
 * stays on offer.
 */
export interface Deload {
  exerciseId: string;
  stalledKg: number;
  deloadKg: number;
  createdOn: string;
}

/**
 * About 10% lighter, on a weight the user can actually load.
 *
 * Snapped to the equipment's increment (so a barbell deload from 80 lands on 72.5, not 72), and
 * always strictly lighter than the stall — rounding must never turn a deload into the same weight.
 * Null when nothing lighter can be loaded (stuck on the lightest dumbbell): there, a deload isn't
 * available, and offering "deload to 2 kg" to someone at 2 kg would be nonsense.
 */
export function deloadWeight(stalledKg: number, equipment: string): number | null {
  // Bodyweight-loaded lifts have no increment of their own; a kilo is the finest anyone loads.
  const step = incrementForEquipment(equipment) || 1;
  let target = Math.round((stalledKg * 0.9) / step) * step;
  if (target >= stalledKg) target = stalledKg - step;
  target = Math.round(target * 100) / 100;
  return target >= step ? target : null;
}

/** Still waiting to be used: the last logged session is still at the weight that stalled. */
export function isDeloadActive(deload: Deload, logs: WorkoutLogEntry[]): boolean {
  const last = lastPerformance(logs, deload.exerciseId);
  return last !== null && topWeight(last.log.sets) === deload.stalledKg;
}

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
  history: WorkoutLogEntry[] = [],
  deload?: Deload
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

  // A deload the user asked for overrides the usual rule — but only while it still applies, i.e.
  // they're still at the weight that stalled. Reps go to the top of the range: at a lighter load
  // they're achievable, and hitting them is exactly what earns the climb back.
  if (deload && deload.exerciseId === performance.log.exerciseId && weight === deload.stalledKg) {
    return {
      weightKg: deload.deloadKg,
      targetReps: range.max,
      action: 'deload',
      incrementKg: increment,
      previous,
      sessionsAtWeight,
    };
  }

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

/**
 * What each library exercise actually does, finer than its muscle-group category.
 *
 * "Legs" holds both a back squat and a calf raise; offering one as a swap for the other is no
 * swap at all. The pattern is what makes a substitute train the same thing — and it crosses
 * categories where the library's filing does: a deadlift ("back") and a Romanian deadlift
 * ("glutes") are both hinges. A test keeps every library exercise in this table.
 */
export const MOVEMENT_PATTERN: Record<string, string> = {
  // pushes
  'bench-press': 'horizontal_push', 'decline-bench-press': 'horizontal_push', 'decline-db-press': 'horizontal_push',
  'incline-db-press': 'horizontal_push', 'push-up': 'horizontal_push', dips: 'horizontal_push',
  ohp: 'vertical_push', 'arnold-press': 'vertical_push',
  'cable-fly': 'chest_fly', 'pec-deck-fly': 'chest_fly',
  // pulls
  'barbell-row': 'horizontal_pull', 'chest-supported-row': 'horizontal_pull', 'single-arm-db-row': 'horizontal_pull', 't-bar-row': 'horizontal_pull',
  'lat-pulldown': 'vertical_pull', 'pull-up': 'vertical_pull',
  // lower body
  squat: 'squat', 'front-squat': 'squat', 'goblet-squat': 'squat', 'leg-press': 'squat',
  lunge: 'lunge', 'bulgarian-split-squat': 'lunge', 'step-up': 'lunge',
  deadlift: 'hinge', 'rack-pull': 'hinge', rdl: 'hinge', 'sumo-deadlift': 'hinge', 'kettlebell-swing': 'hinge',
  'hip-thrust': 'hip_extension', 'glute-bridge': 'hip_extension', 'cable-kickback': 'hip_extension',
  'leg-curl': 'knee_flexion', 'leg-extension': 'knee_extension', 'calf-raise': 'calf',
  // arms & shoulders
  'barbell-curl': 'biceps', 'hammer-curl': 'biceps', 'preacher-curl': 'biceps',
  'skull-crusher': 'triceps', 'tricep-pushdown': 'triceps', 'close-grip-bench-press': 'triceps',
  'lateral-raise': 'shoulder_raise', 'front-raise': 'shoulder_raise', 'face-pull': 'rear_delt', shrugs: 'shrug',
  // core
  plank: 'anti_extension', 'ab-wheel-rollout': 'anti_extension', 'dead-bug': 'anti_extension', 'side-plank': 'anti_lateral',
  'bicycle-crunch': 'trunk_flexion', 'cable-crunch': 'trunk_flexion', 'hanging-leg-raise': 'trunk_flexion', 'russian-twist': 'rotation',
  // conditioning
  burpee: 'conditioning', 'mountain-climber': 'conditioning', 'jumping-jack': 'conditioning', thruster: 'squat_press',
  running: 'cardio', 'jump-rope': 'cardio', 'rowing-machine': 'cardio', cycling: 'cardio',
};

export interface SwapOptions {
  /** Same movement pattern — a true substitute, from any muscle group. */
  close: Exercise[];
  /** The rest of the same muscle group — still works the area, less like-for-like. */
  other: Exercise[];
}

/**
 * Exercises that can stand in for this one today.
 *
 * Closest first: the same movement pattern. Then the rest of the muscle group, kept apart and
 * labelled as such rather than presented as equivalent. Throughout, the same kind of work — a
 * rep-counted lift is never swapped for a timed hold, because the next session's suggestion is
 * built from reps and a 30-second plank has none. Within each group different equipment sorts
 * first: the usual reason to swap is that the bar, the rack or the machine isn't free.
 */
export function swapCandidates(exercise: Exercise, library: Exercise[]): SwapOptions {
  const timed = parseRepRange(exercise.reps) === null;
  const equipment = exercise.equipment.toLowerCase();
  const pattern = MOVEMENT_PATTERN[exercise.id];
  const eligible = library.filter((e) => e.id !== exercise.id && (parseRepRange(e.reps) === null) === timed);
  const order = (a: Exercise, b: Exercise) => {
    const aSame = a.equipment.toLowerCase() === equipment ? 1 : 0;
    const bSame = b.equipment.toLowerCase() === equipment ? 1 : 0;
    return aSame - bSame || a.name.localeCompare(b.name);
  };
  const close = pattern ? eligible.filter((e) => MOVEMENT_PATTERN[e.id] === pattern).sort(order) : [];
  const other = eligible.filter((e) => e.category === exercise.category && !close.includes(e)).sort(order);
  return { close, other };
}
