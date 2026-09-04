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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { useSyncQueue, type SyncOp, type SyncTable } from './sync-queue';
import { deletePhotoFromStorage, downloadPhotoFromStorage, hasPhotoFile, uploadPhotoToStorage } from './photo-store';
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

// --- progress photos ------------------------------------------------------
// The row (date/note/storage_path) goes through the normal upsert queue like everything else;
// the image bytes don't fit that shape, so they're uploaded to Storage directly, out of band.

function progressPhotoToRow(userId: string, p: ProgressPhoto, storagePath?: string) {
  return { id: p.id, user_id: userId, date: p.date, note: p.note ?? null, storage_path: storagePath ?? null };
}

function progressPhotoFromRow(row: Record<string, any>): ProgressPhoto {
  return { id: row.id, date: row.date, note: row.note ?? undefined };
}

function pushProgressPhoto(userId: string, photo: ProgressPhoto) {
  enqueue({ key: `progress_photos:${photo.id}`, table: 'progress_photos', op: 'upsert', row: progressPhotoToRow(userId, photo) });
}

function deleteProgressPhoto(userId: string, id: string) {
  enqueue({ key: `progress_photos:${id}`, table: 'progress_photos', op: 'delete', match: { id } });
  // Best-effort: if this fails offline, the object is simply orphaned in Storage — it's already
  // gone from every user-visible list, so nothing depends on this succeeding immediately.
  void deletePhotoFromStorage(userId, id).catch(() => {});
}

/**
 * Uploads the local image for `id` to Storage and stamps its row with the resulting path, so
 * other devices know there's a file to pull down. Fire-and-forget from the caller's side — a
 * failure here just means the row's storage_path stays null and a later run can retry.
 */
export async function syncProgressPhotoFile(userId: string, photo: ProgressPhoto): Promise<void> {
  const path = await uploadPhotoToStorage(userId, photo.id);
  enqueue({ key: `progress_photos:${photo.id}`, table: 'progress_photos', op: 'upsert', row: progressPhotoToRow(userId, photo, path) });
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
  syncProgressPhotoFile,
};

const WATERMARK_KEY = 'fittrack-sync-watermark';

/** Highest server-side `updated_at` this device has already pulled, per user. Server-generated
 * values are used rather than the device clock so skew can't cause rows to be skipped. */
async function readWatermark(userId: string): Promise<string | null> {
  const raw = await AsyncStorage.getItem(WATERMARK_KEY);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as Record<string, string>)[userId] ?? null;
  } catch {
    return null;
  }
}

async function writeWatermark(userId: string, value: string): Promise<void> {
  const raw = await AsyncStorage.getItem(WATERMARK_KEY);
  let map: Record<string, string> = {};
  try {
    if (raw) map = JSON.parse(raw) as Record<string, string>;
  } catch {
    map = {};
  }
  map[userId] = value;
  await AsyncStorage.setItem(WATERMARK_KEY, JSON.stringify(map));
}

function maxUpdatedAt(rowSets: { updated_at?: string }[][], previous: string | null): string | null {
  let max = previous;
  for (const rows of rowSets) {
    for (const row of rows) {
      if (row.updated_at && (!max || row.updated_at > max)) max = row.updated_at;
    }
  }
  return max;
}

/** Applies incoming rows on top of what's already local, keyed by `keyOf`. Unlike
 * mergeCollection this never drops a local row just because it wasn't in the response — a delta
 * response only contains what changed, so absence means "unchanged", not "deleted". */
function applyDelta<T>(table: SyncTable, keyOf: (item: T) => string, incoming: T[], local: T[]): T[] {
  const pendingUpsert = pendingKeysForTable(table, 'upsert');
  const pendingDelete = pendingKeysForTable(table, 'delete');
  const byKey = new Map(local.map((item) => [keyOf(item), item]));
  for (const row of incoming) {
    const key = keyOf(row);
    // A row this device is still pushing (or deleting) stays as the local copy — push wins its
    // own race with pull, same rule mergeCollection follows.
    if (pendingUpsert.has(key) || pendingDelete.has(key)) continue;
    byKey.set(key, row);
  }
  return [...byKey.values()];
}

/**
 * Syncs remote data into the local store.
 *
 * `full` (sign-in and cold start) fetches every row and lets the server's set win, which is what
 * makes deletes from another device disappear here too. Foreground refreshes instead pull only
 * rows whose `updated_at` is newer than the last watermark, so returning to the app costs one
 * small delta rather than re-downloading the user's entire history. The tradeoff is that a
 * delete made on another device isn't reflected until the next full sync — acceptable for a
 * single-user app, and the alternative (tombstone rows) buys little for the complexity.
 *
 * Either way a row this device hasn't finished pushing is never overwritten.
 */
export async function pullRemote(userId: string, { full = false }: { full?: boolean } = {}): Promise<void> {
  const watermark = full ? null : await readWatermark(userId);

  const scoped = (table: string) => {
    const query = supabase.from(table).select('*').eq('user_id', userId);
    return watermark ? query.gt('updated_at', watermark) : query;
  };

  const profileQuery = supabase.from('profiles').select('*').eq('id', userId);

  const [profileRes, weightRes, stepsRes, sleepRes, measurementsRes, foodRes, savedMealsRes, scheduledRes, workoutLogsRes, photosRes] =
    await Promise.all([
      (watermark ? profileQuery.gt('updated_at', watermark) : profileQuery).maybeSingle(),
      scoped('weight_entries'),
      scoped('steps_entries'),
      scoped('sleep_entries'),
      scoped('body_measurements'),
      scoped('food_entries'),
      scoped('saved_meals'),
      scoped('scheduled_workouts'),
      scoped('workout_logs'),
      scoped('progress_photos'),
    ]);

  const current = useAppStore.getState();
  const hasPendingProfile = pendingKeysForTable('profiles').has(userId);
  // On a delta pull an absent profile means "unchanged", not "no profile" — only a full pull can
  // conclude the latter.
  const keepLocalProfile = hasPendingProfile || (!profileRes.data && !full);
  const merge = watermark ? applyDelta : mergeCollection;

  useAppStore.setState({
    profile: keepLocalProfile ? current.profile : profileRes.data ? profileFromRow(profileRes.data) : null,
    weightHistory: merge('weight_entries', (e) => e.date, (weightRes.data ?? []).map((r) => ({ date: r.date, weightKg: Number(r.weight_kg) })), current.weightHistory),
    stepsHistory: merge('steps_entries', (e) => e.date, (stepsRes.data ?? []).map((r) => ({ date: r.date, steps: r.steps })), current.stepsHistory),
    sleepHistory: merge('sleep_entries', (e) => e.date, (sleepRes.data ?? []).map((r) => ({ date: r.date, hours: Number(r.hours) })), current.sleepHistory),
    measurementsHistory: merge(
      'body_measurements',
      (e) => e.date,
      (measurementsRes.data ?? []).map(measurementFromRow),
      current.measurementsHistory
    ),
    foodEntries: merge('food_entries', (e) => e.id, (foodRes.data ?? []).map(foodEntryFromRow), current.foodEntries),
    savedMeals: merge('saved_meals', (e) => e.id, (savedMealsRes.data ?? []).map(savedMealFromRow), current.savedMeals),
    scheduledWorkouts: merge('scheduled_workouts', (e) => e.day, (scheduledRes.data ?? []).map(scheduledWorkoutFromRow), current.scheduledWorkouts),
    workoutLogs: merge('workout_logs', (e) => e.id, (workoutLogsRes.data ?? []).map(workoutLogFromRow), current.workoutLogs),
    progressPhotos: merge('progress_photos', (e) => e.id, (photosRes.data ?? []).map(progressPhotoFromRow), current.progressPhotos),
  });

  const nextWatermark = maxUpdatedAt(
    [
      profileRes.data ? [profileRes.data] : [],
      weightRes.data ?? [],
      stepsRes.data ?? [],
      sleepRes.data ?? [],
      measurementsRes.data ?? [],
      foodRes.data ?? [],
      savedMealsRes.data ?? [],
      scheduledRes.data ?? [],
      workoutLogsRes.data ?? [],
      photosRes.data ?? [],
    ],
    watermark
  );
  if (nextWatermark) await writeWatermark(userId, nextWatermark);

  // Photos are metadata rows plus a Storage object — download any file this device doesn't have
  // yet (e.g. a photo taken on another device). Fire-and-forget in the background; each is
  // independent, so one failure doesn't block the rest.
  for (const row of photosRes.data ?? []) {
    if (row.storage_path && !hasPhotoFile(row.id)) {
      void downloadPhotoFromStorage(userId, row.id).catch(() => {});
    }
  }
}
