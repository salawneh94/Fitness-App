import type { ExerciseLogEntry, SetEntry, UnitSystem, WorkoutLogEntry } from './types';
import { estimate1RM } from './calc';
import { displayWeight, weightUnitLabel } from './units';

/**
 * Past this many reps, Epley's 1RM estimate stops meaning much — 25 reps at 40 kg "estimates" a
 * 73 kg max that the lifter could not come close to. Sets above it still count for rep records.
 */
const MAX_REPS_FOR_ESTIMATE = 12;
/** An estimated-1RM gain smaller than this is rounding noise, not a record. */
const MIN_E1RM_GAIN = 0.005;

export type RecordKind = 'heaviest' | 'best_set' | 'most_reps';

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  kind: RecordKind;
  /** "Heaviest ever: 85 kg × 5" */
  headline: string;
  /** "previous best 82.5 kg" — the comparison that makes it a record. */
  detail: string;
}

function load(kg: number, unit: UnitSystem): string {
  return `${Math.round(displayWeight(kg, unit) * 10) / 10} ${weightUnitLabel(unit)}`;
}

function setsFor(history: WorkoutLogEntry[], exerciseId: string): SetEntry[] {
  return history.flatMap((w) => w.exerciseLogs?.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets) ?? []);
}

function bestEstimate(sets: SetEntry[]): { e1rm: number; set: SetEntry } | null {
  let best: { e1rm: number; set: SetEntry } | null = null;
  for (const s of sets) {
    if (s.weightKg <= 0 || s.reps <= 0 || s.reps > MAX_REPS_FOR_ESTIMATE) continue;
    const e1rm = estimate1RM(s.weightKg, s.reps);
    if (!best || e1rm > best.e1rm) best = { e1rm, set: s };
  }
  return best;
}

function maxRepsAt(sets: SetEntry[], weightKg: number): number {
  return sets.filter((s) => s.weightKg === weightKg).reduce((m, s) => Math.max(m, s.reps), 0);
}

/**
 * The personal records set in one session, at most one per exercise — the most meaningful kind.
 *
 * Every set, rep and kilo was already logged, and the only thing that ever acknowledged progress
 * was a line on a chart nobody opens mid-week. A record is the moment that makes training feel
 * like it's working, and saying so at the end of the session is free.
 *
 * In order of precedence:
 * - heaviest: a weight never lifted before for this exercise;
 * - best set: the strongest set by estimated 1RM (sets of 12 reps or fewer), e.g. 80 × 9 after
 *   80 × 8 — progress at the same weight is still progress;
 * - most reps: more reps at a given weight than ever before, which is how bodyweight work and
 *   high-rep sets progress.
 *
 * The first time an exercise is logged sets a baseline, not a record: congratulating someone on a
 * "PR" for the first squat they ever logged would make the word mean nothing.
 */
export function findPersonalRecords(session: ExerciseLogEntry[], history: WorkoutLogEntry[], unit: UnitSystem): PersonalRecord[] {
  const records: PersonalRecord[] = [];
  for (const ex of session) {
    const sets = ex.sets.filter((s) => s.reps > 0);
    if (sets.length === 0) continue;
    const before = setsFor(history, ex.exerciseId).filter((s) => s.reps > 0);
    if (before.length === 0) continue;

    const base = { exerciseId: ex.exerciseId, exerciseName: ex.exerciseName };

    const top = sets.reduce((a, b) => (b.weightKg > a.weightKg || (b.weightKg === a.weightKg && b.reps > a.reps) ? b : a));
    const prevTop = before.reduce((m, s) => Math.max(m, s.weightKg), 0);
    if (top.weightKg > 0 && top.weightKg > prevTop) {
      records.push({
        ...base,
        kind: 'heaviest',
        headline: `Heaviest ever: ${load(top.weightKg, unit)} × ${top.reps}`,
        detail: prevTop > 0 ? `previous best ${load(prevTop, unit)}` : 'first time adding weight',
      });
      continue;
    }

    const now = bestEstimate(sets);
    const then = bestEstimate(before);
    if (now && then && now.e1rm > then.e1rm * (1 + MIN_E1RM_GAIN)) {
      records.push({
        ...base,
        kind: 'best_set',
        headline: `Best set: ${load(now.set.weightKg, unit)} × ${now.set.reps}`,
        detail: `estimated 1RM ${load(Math.round(now.e1rm), unit)}, up from ${load(Math.round(then.e1rm), unit)}`,
      });
      continue;
    }

    // Most reps at any weight used today, compared with the most ever done at that same weight.
    let repRecord: { weightKg: number; reps: number; previous: number } | null = null;
    for (const s of sets) {
      const previous = maxRepsAt(before, s.weightKg);
      if (previous > 0 && s.reps > previous && (!repRecord || s.reps - previous > repRecord.reps - repRecord.previous)) {
        repRecord = { weightKg: s.weightKg, reps: s.reps, previous };
      }
    }
    if (repRecord) {
      records.push({
        ...base,
        kind: 'most_reps',
        headline:
          repRecord.weightKg > 0
            ? `Most reps at ${load(repRecord.weightKg, unit)}: ${repRecord.reps}`
            : `Most reps: ${repRecord.reps}`,
        detail: `previous best ${repRecord.previous}`,
      });
    }
  }
  return records;
}

/** Records set by a logged session, judged against everything logged on earlier days. */
export function recordsForLog(log: WorkoutLogEntry, all: WorkoutLogEntry[], unit: UnitSystem): PersonalRecord[] {
  return findPersonalRecords(log.exerciseLogs ?? [], all.filter((w) => w.date < log.date), unit);
}
