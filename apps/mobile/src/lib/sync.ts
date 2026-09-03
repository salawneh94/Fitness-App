import type {
  BodyMeasurementEntry,
  FoodEntry,
  Profile,
  ProgressPhoto,
  SavedMeal,
  ScheduledWorkout,
  SleepEntry,
  StepsEntry,
  WeightEntry,
  WorkoutLogEntry,
} from '@fittrack/shared';
import { supabase } from './supabase';
import { useSyncQueue, type SyncOp, type SyncTable } from './sync-queue';
import { useAppStore } from '@/store/useAppStore';

function pendingKeysForTable(table: SyncTable, op?: SyncOp['op']): Set<string> {
  const prefix = `${table}:`;
  const keys = new Set<string>();
  for (const pending of useSyncQueue.getState().pendingOps) {
    if (pending.table !== table || (op && pending.op !== op)) continue;
    if (pending.key.startsWith(prefix)) keys.add(pending.key.slice(prefix.length));
  }
  return keys;
}

function enqueue(op: SyncOp) {
  useSyncQueue.getState().enqueue(op);
}

/** Merges freshly-pulled remote rows with local state: any key with a pending local write keeps
 * its local value (it hasn't been confirmed on the server yet), everything else adopts the
 * server's version — so a pull never clobbers an edit this device hasn't finished pushing. */
function mergeCollection<T>(
  table: SyncTable,
  keyOf: (item: T) => string,
  remote: T[],
  local: T[]
): T[] {
  const pendingUpsert = pendingKeysForTable(table, 'upsert');
  const pendingDelete = pendingKeysForTable(table, 'delete');
  const remoteFiltered = remote.filter((r) => !pendingUpsert.has(keyOf(r)) && !pendingDelete.has(keyOf(r)));
  const localPending = local.filter((l) => pendingUpsert.has(keyOf(l)));
  return [...remoteFiltered, ...localPending];
}

// --- profiles ---------------------------------------------------------

function profileToRow(userId: string, p: Profile) {
  return {
    id: userId,
    name: p.name,
    age: p.age,
    sex: p.sex,
    height_cm: p.heightCm,
    weight_kg: p.weightKg,
    goal: p.goal,
    target_weight_kg: p.targetWeightKg ?? null,
    timeframe_weeks: p.timeframeWeeks,
    expectations: p.expectations,
    activity_level: p.activityLevel,
    preferred_days_per_week: p.preferredDaysPerWeek,
    unit_system: p.unitSystem,
    created_at: p.createdAt,
  };
}

function profileFromRow(row: Record<string, any>): Profile {
  return {
    name: row.name,
    age: row.age,
    sex: row.sex,
    heightCm: Number(row.height_cm),
    weightKg: Number(row.weight_kg),
    goal: row.goal,
    targetWeightKg: row.target_weight_kg == null ? undefined : Number(row.target_weight_kg),
    timeframeWeeks: row.timeframe_weeks,
    expectations: row.expectations ?? '',
    activityLevel: row.activity_level,
    preferredDaysPerWeek: row.preferred_days_per_week,
    unitSystem: row.unit_system,
    createdAt: row.created_at,
  };
}

export function pushProfile(userId: string, profile: Profile) {
  enqueue({ key: `profiles:${userId}`, table: 'profiles', op: 'upsert', row: profileToRow(userId, profile) });
}

// --- date-keyed history tables ----------------------------------------

function pushWeight(userId: string, entry: WeightEntry) {
  enqueue({
    key: `weight_entries:${entry.date}`,
    table: 'weight_entries',
    op: 'upsert',
    row: { user_id: userId, date: entry.date, weight_kg: entry.weightKg },
  });
}

function pushSteps(userId: string, entry: StepsEntry) {
  enqueue({
    key: `steps_entries:${entry.date}`,
    table: 'steps_entries',
    op: 'upsert',
    row: { user_id: userId, date: entry.date, steps: entry.steps },
  });
}

function pushSleep(userId: string, entry: SleepEntry) {
  enqueue({
    key: `sleep_entries:${entry.date}`,
    table: 'sleep_entries',
    op: 'upsert',
    row: { user_id: userId, date: entry.date, hours: entry.hours },
  });
}

function measurementFromRow(row: Record<string, any>): BodyMeasurementEntry {
  return {
    date: row.date,
    waistCm: row.waist_cm ?? undefined,
    chestCm: row.chest_cm ?? undefined,
    armsCm: row.arms_cm ?? undefined,
    hipsCm: row.hips_cm ?? undefined,
    thighsCm: row.thighs_cm ?? undefined,
  };
}

function pushMeasurement(userId: string, entry: BodyMeasurementEntry) {
  enqueue({
    key: `body_measurements:${entry.date}`,
    table: 'body_measurements',
    op: 'upsert',
    row: {
      user_id: userId,
      date: entry.date,
      waist_cm: entry.waistCm ?? null,
      chest_cm: entry.chestCm ?? null,
      arms_cm: entry.armsCm ?? null,
      hips_cm: entry.hipsCm ?? null,
      thighs_cm: entry.thighsCm ?? null,
    },
  });
}

// --- food ---------------------------------------------------------------

function foodEntryToRow(userId: string, e: FoodEntry) {
  return {
    id: e.id,
    user_id: userId,
    date: e.date,
    meal: e.meal,
    name: e.name,
    brand: e.brand ?? null,
    quantity: e.quantity,
    serving_label: e.servingLabel ?? null,
    calories: e.calories,
    protein_g: e.proteinG,
    carbs_g: e.carbsG,
    fat_g: e.fatG,
    micros: e.micros ?? null,
    source: e.source,
    barcode: e.barcode ?? null,
    logged_at: e.loggedAt,
  };
}

function foodEntryFromRow(row: Record<string, any>): FoodEntry {
  return {
    id: row.id,
    date: row.date,
    meal: row.meal,
    name: row.name,
    brand: row.brand ?? undefined,
    quantity: Number(row.quantity),
    servingLabel: row.serving_label ?? undefined,
    calories: Number(row.calories),
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
    micros: row.micros ?? undefined,
    source: row.source,
    barcode: row.barcode ?? undefined,
    loggedAt: row.logged_at,
  };
}

function pushFoodEntry(userId: string, entry: FoodEntry) {
  enqueue({ key: `food_entries:${entry.id}`, table: 'food_entries', op: 'upsert', row: foodEntryToRow(userId, entry) });
}

function deleteFoodEntry(id: string) {
  enqueue({ key: `food_entries:${id}`, table: 'food_entries', op: 'delete', match: { id } });
}

// --- saved meals ----------------------------------------------------------

function savedMealToRow(userId: string, m: SavedMeal) {
  return { id: m.id, user_id: userId, name: m.name, items: m.items, created_at: m.createdAt };
}

function savedMealFromRow(row: Record<string, any>): SavedMeal {
  return { id: row.id, name: row.name, items: row.items ?? [], createdAt: row.created_at };
}

function pushSavedMeal(userId: string, meal: SavedMeal) {
  enqueue({ key: `saved_meals:${meal.id}`, table: 'saved_meals', op: 'upsert', row: savedMealToRow(userId, meal) });
}

function deleteSavedMeal(id: string) {
  enqueue({ key: `saved_meals:${id}`, table: 'saved_meals', op: 'delete', match: { id } });
}

// --- workouts ---------------------------------------------------------

function scheduledWorkoutToRow(userId: string, w: ScheduledWorkout) {
  return { user_id: userId, day: w.day, name: w.name, exercises: w.exercises };
}

function scheduledWorkoutFromRow(row: Record<string, any>): ScheduledWorkout {
  return { id: row.id, day: row.day, name: row.name, exercises: row.exercises ?? [] };
}

function pushScheduledWorkout(userId: string, w: ScheduledWorkout) {
  enqueue({
    key: `scheduled_workouts:${w.day}`,
    table: 'scheduled_workouts',
    op: 'upsert',
    row: scheduledWorkoutToRow(userId, w),
  });
}

function deleteScheduledWorkoutDay(day: ScheduledWorkout['day']) {
  enqueue({ key: `scheduled_workouts:${day}`, table: 'scheduled_workouts', op: 'delete', match: { day } });
}

function workoutLogToRow(userId: string, log: WorkoutLogEntry) {
  return {
    id: log.id,
    user_id: userId,
    date: log.date,
    workout_name: log.workoutName,
    duration_min: log.durationMin,
    calories_burned: log.caloriesBurned ?? null,
    notes: log.notes ?? null,
    exercise_logs: log.exerciseLogs ?? null,
  };
}

function workoutLogFromRow(row: Record<string, any>): WorkoutLogEntry {
  return {
    id: row.id,
    date: row.date,
    workoutName: row.workout_name,
    durationMin: row.duration_min,
    caloriesBurned: row.calories_burned ?? undefined,
    notes: row.notes ?? undefined,
    exerciseLogs: row.exercise_logs ?? undefined,
  };
}

function pushWorkoutLog(userId: string, log: WorkoutLogEntry) {
  enqueue({ key: `workout_logs:${log.id}`, table: 'workout_logs', op: 'upsert', row: workoutLogToRow(userId, log) });
}

function deleteWorkoutLog(id: string) {
  enqueue({ key: `workout_logs:${id}`, table: 'workout_logs', op: 'delete', match: { id } });
}

// --- progress photos (metadata only until M4) ---------------------------

function progressPhotoToRow(userId: string, p: ProgressPhoto) {
  return { id: p.id, user_id: userId, date: p.date, note: p.note ?? null };
}

function progressPhotoFromRow(row: Record<string, any>): ProgressPhoto {
  return { id: row.id, date: row.date, note: row.note ?? undefined };
}

function pushProgressPhoto(userId: string, photo: ProgressPhoto) {
  enqueue({ key: `progress_photos:${photo.id}`, table: 'progress_photos', op: 'upsert', row: progressPhotoToRow(userId, photo) });
}

function deleteProgressPhoto(id: string) {
  enqueue({ key: `progress_photos:${id}`, table: 'progress_photos', op: 'delete', match: { id } });
}

export const push = {
  profile: pushProfile,
  weight: pushWeight,
  steps: pushSteps,
  sleep: pushSleep,
  measurement: pushMeasurement,
  foodEntry: pushFoodEntry,
  deleteFoodEntry,
  savedMeal: pushSavedMeal,
  deleteSavedMeal,
  scheduledWorkout: pushScheduledWorkout,
  deleteScheduledWorkoutDay,
  workoutLog: pushWorkoutLog,
  deleteWorkoutLog,
  progressPhoto: pushProgressPhoto,
  deleteProgressPhoto,
};

/**
 * Pulls every table for `userId` and merges it into the local store, called right after sign-in
 * and whenever the app returns to the foreground while signed in. Never overwrites a row this
 * device has an unconfirmed local write for (see mergeCollection above) — push always wins its
 * own race with pull.
 */
export async function pullRemote(userId: string): Promise<void> {
  const [profileRes, weightRes, stepsRes, sleepRes, measurementsRes, foodRes, savedMealsRes, scheduledRes, workoutLogsRes, photosRes] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('weight_entries').select('*').eq('user_id', userId),
      supabase.from('steps_entries').select('*').eq('user_id', userId),
      supabase.from('sleep_entries').select('*').eq('user_id', userId),
      supabase.from('body_measurements').select('*').eq('user_id', userId),
      supabase.from('food_entries').select('*').eq('user_id', userId),
      supabase.from('saved_meals').select('*').eq('user_id', userId),
      supabase.from('scheduled_workouts').select('*').eq('user_id', userId),
      supabase.from('workout_logs').select('*').eq('user_id', userId),
      supabase.from('progress_photos').select('*').eq('user_id', userId),
    ]);

  const current = useAppStore.getState();
  const hasPendingProfile = pendingKeysForTable('profiles').has(userId);

  useAppStore.setState({
    profile: hasPendingProfile || !profileRes.data ? current.profile : profileFromRow(profileRes.data),
    weightHistory: mergeCollection('weight_entries', (e) => e.date, (weightRes.data ?? []).map((r) => ({ date: r.date, weightKg: Number(r.weight_kg) })), current.weightHistory),
    stepsHistory: mergeCollection('steps_entries', (e) => e.date, (stepsRes.data ?? []).map((r) => ({ date: r.date, steps: r.steps })), current.stepsHistory),
    sleepHistory: mergeCollection('sleep_entries', (e) => e.date, (sleepRes.data ?? []).map((r) => ({ date: r.date, hours: Number(r.hours) })), current.sleepHistory),
    measurementsHistory: mergeCollection(
      'body_measurements',
      (e) => e.date,
      (measurementsRes.data ?? []).map(measurementFromRow),
      current.measurementsHistory
    ),
    foodEntries: mergeCollection('food_entries', (e) => e.id, (foodRes.data ?? []).map(foodEntryFromRow), current.foodEntries),
    savedMeals: mergeCollection('saved_meals', (e) => e.id, (savedMealsRes.data ?? []).map(savedMealFromRow), current.savedMeals),
    scheduledWorkouts: mergeCollection('scheduled_workouts', (e) => e.day, (scheduledRes.data ?? []).map(scheduledWorkoutFromRow), current.scheduledWorkouts),
    workoutLogs: mergeCollection('workout_logs', (e) => e.id, (workoutLogsRes.data ?? []).map(workoutLogFromRow), current.workoutLogs),
    progressPhotos: mergeCollection('progress_photos', (e) => e.id, (photosRes.data ?? []).map(progressPhotoFromRow), current.progressPhotos),
  });
}
