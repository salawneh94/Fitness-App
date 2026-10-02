import type { CardioActivity, CardioEntry, UnitSystem, WorkoutLogEntry } from './types';
import type { PersonalRecord } from './records';
import { addDaysISO } from './calc';
import { mondayOf } from './planProgress';

export const KM_PER_MILE = 1.609344;

export const CARDIO_ACTIVITIES: { id: CardioActivity; label: string; noun: string }[] = [
  { id: 'run', label: 'Run', noun: 'run' },
  { id: 'walk', label: 'Walk', noun: 'walk' },
  { id: 'cycle', label: 'Cycle', noun: 'ride' },
  { id: 'row', label: 'Row', noun: 'row' },
  { id: 'swim', label: 'Swim', noun: 'swim' },
  { id: 'other', label: 'Other', noun: 'session' },
];

const nounOf = (a: CardioActivity) => CARDIO_ACTIVITIES.find((x) => x.id === a)!.noun;

/** Which activity a library cardio exercise is, when it's logged from the workout player. */
export function activityForExercise(exerciseId: string): CardioActivity {
  switch (exerciseId) {
    case 'running':
      return 'run';
    case 'cycling':
      return 'cycle';
    case 'rowing-machine':
      return 'row';
    default:
      return 'other';
  }
}

// --- units ---------------------------------------------------------------------------------------

export function distanceUnitLabel(unit: UnitSystem): string {
  return unit === 'imperial' ? 'mi' : 'km';
}

export function displayDistance(km: number, unit: UnitSystem): number {
  return unit === 'imperial' ? km / KM_PER_MILE : km;
}

/** Stored to the metre — finer than any watch measures, and no 4.988966400000001 in an export. */
export function toKmFromDisplay(value: number, unit: UnitSystem): number {
  return Math.round((unit === 'imperial' ? value * KM_PER_MILE : value) * 1000) / 1000;
}

/** "5.2 km", "10 km", "3.1 mi" — one decimal at most. */
export function formatDistance(km: number, unit: UnitSystem): string {
  return `${Math.round(displayDistance(km, unit) * 10) / 10} ${distanceUnitLabel(unit)}`;
}

function clock(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Seconds per km — lower is faster. Null without a usable distance. */
function secondsPerKm(e: CardioEntry): number | null {
  return e.distanceKm && e.distanceKm > 0 && e.durationMin > 0 ? (e.durationMin * 60) / e.distanceKm : null;
}

/**
 * Pace the way each sport talks about it: minutes per km (or mile) on foot, speed on a bike,
 * time per 500 m on a rower — the rower's own display, in either unit system — and per 100 m in
 * the pool. Null when there's no distance, or for "other".
 */
export function formatPace(e: CardioEntry, unit: UnitSystem): string | null {
  const spk = secondsPerKm(e);
  if (spk === null) return null;
  switch (e.activity) {
    case 'run':
    case 'walk':
      return unit === 'imperial' ? `${clock(spk * KM_PER_MILE)} /mi` : `${clock(spk)} /km`;
    case 'cycle': {
      const kmh = 3600 / spk;
      return unit === 'imperial' ? `${(kmh / KM_PER_MILE).toFixed(1)} mph` : `${kmh.toFixed(1)} km/h`;
    }
    case 'row':
      return `${clock(spk / 2)} /500m`;
    case 'swim':
      return `${clock(spk / 10)} /100m`;
    default:
      return null;
  }
}

// --- calories ------------------------------------------------------------------------------------

/**
 * MET values from the Compendium of Physical Activities, for a moderate effort: running at about
 * 6 mph (9.8), walking at a brisk 3 mph (3.5), stationary cycling, moderate (6.8), rowing machine,
 * moderate (7.0), freestyle laps, moderate (5.8). Used when there's no distance to go on.
 */
const MET: Partial<Record<CardioActivity, number>> = { run: 9.8, walk: 3.5, cycle: 6.8, row: 7.0, swim: 5.8 };

/**
 * A calorie estimate for a cardio session — clearly an estimate, and editable before saving.
 *
 * On foot, distance predicts energy far better than time: running costs roughly 1 kcal per kg of
 * bodyweight per km almost regardless of pace, walking about half that. Everything else (and on
 * foot without a distance) uses METs × weight × hours. Null for "other", where any number would
 * be invented.
 */
export function estimateCardioCalories(e: CardioEntry, weightKg: number): number | null {
  if (e.durationMin <= 0 || weightKg <= 0) return null;
  if (e.distanceKm && e.distanceKm > 0 && (e.activity === 'run' || e.activity === 'walk')) {
    return Math.round((e.activity === 'run' ? 1.0 : 0.5) * weightKg * e.distanceKm);
  }
  const met = MET[e.activity];
  return met ? Math.round(met * weightKg * (e.durationMin / 60)) : null;
}

// --- totals --------------------------------------------------------------------------------------

/** Minutes of cardio logged between two dates, inclusive. */
export function cardioMinutes(logs: WorkoutLogEntry[], from: string, to: string): number {
  let total = 0;
  for (const l of logs) {
    if (l.date < from || l.date > to) continue;
    for (const c of l.cardio ?? []) total += c.durationMin;
  }
  return total;
}

export interface CardioWeek {
  weekStart: string; // Monday
  distanceKm: number;
  minutes: number;
  sessions: number;
}

/** The last `weeks` calendar weeks of cardio, oldest first, this week last. */
export function weeklyCardio(logs: WorkoutLogEntry[], today: string, weeks = 8): CardioWeek[] {
  const thisMonday = mondayOf(today);
  const out: CardioWeek[] = Array.from({ length: weeks }, (_, i) => ({
    weekStart: addDaysISO(thisMonday, -7 * (weeks - 1 - i)),
    distanceKm: 0,
    minutes: 0,
    sessions: 0,
  }));
  const byStart = new Map(out.map((w) => [w.weekStart, w]));
  for (const l of logs) {
    if (!l.cardio?.length || l.date > today) continue;
    const week = byStart.get(mondayOf(l.date));
    if (!week) continue;
    week.sessions += 1;
    for (const c of l.cardio) {
      week.minutes += c.durationMin;
      week.distanceKm += c.distanceKm ?? 0;
    }
  }
  return out;
}

// --- records -------------------------------------------------------------------------------------

/**
 * The shortest distance a pace can count over. A blistering 300 m on the way back from the shops
 * is not anyone's fastest run.
 */
const MIN_PACE_DISTANCE_KM: Record<CardioActivity, number> = { run: 1, walk: 1, cycle: 3, row: 1, swim: 0.4, other: Infinity };
/** A pace or distance gain smaller than this is a rounding wobble, not a record. */
const MIN_GAIN = 0.005;

/**
 * Distance and pace records set by one session, judged against earlier cardio of the same kind.
 *
 * At most one per activity — the longest beats the fastest — and, as with lifts, the first time
 * an activity is logged sets a baseline rather than a record.
 */
export function cardioRecords(session: CardioEntry[], history: WorkoutLogEntry[], unit: UnitSystem): PersonalRecord[] {
  const records: PersonalRecord[] = [];
  const done = new Set<CardioActivity>();
  for (const e of session) {
    if (done.has(e.activity) || e.activity === 'other') continue;
    const before = history.flatMap((l) => l.cardio ?? []).filter((c) => c.activity === e.activity);
    if (before.length === 0) continue;
    const noun = nounOf(e.activity);
    const base = { exerciseId: `cardio:${e.activity}`, exerciseName: CARDIO_ACTIVITIES.find((a) => a.id === e.activity)!.label };

    const longestBefore = before.reduce((m, c) => Math.max(m, c.distanceKm ?? 0), 0);
    if (e.distanceKm && longestBefore > 0 && e.distanceKm > longestBefore * (1 + MIN_GAIN)) {
      records.push({ ...base, kind: 'longest', headline: `Longest ${noun}: ${formatDistance(e.distanceKm, unit)}`, detail: `previous best ${formatDistance(longestBefore, unit)}` });
      done.add(e.activity);
      continue;
    }

    const min = MIN_PACE_DISTANCE_KM[e.activity];
    const pace = (e.distanceKm ?? 0) >= min ? secondsPerKm(e) : null;
    const paces = before.filter((c) => (c.distanceKm ?? 0) >= min).map(secondsPerKm).filter((p): p is number => p !== null);
    if (pace !== null && paces.length > 0) {
      const best = Math.min(...paces);
      if (pace < best * (1 - MIN_GAIN)) {
        const fmt = (spk: number) => formatPace({ activity: e.activity, durationMin: spk / 60, distanceKm: 1 }, unit)!;
        records.push({ ...base, kind: 'fastest', headline: `Fastest ${noun}: ${fmt(pace)}`, detail: `previous best ${fmt(best)}` });
        done.add(e.activity);
      }
    }
  }
  return records;
}
