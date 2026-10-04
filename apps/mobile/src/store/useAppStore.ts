import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  INSIGHT_SNOOZE_DAYS,
  addDaysISO,
  isDeloadActive,
  todayISO,
  type BodyMeasurementEntry,
  type Deload,
  type FoodEntry,
  type MealType,
  type Profile,
  type ProgressPhoto,
  type SavedMeal,
  type SavedMealItem,
  type ScheduledWorkout,
  type SleepEntry,
  type StepsEntry,
  type WaterEntry,
  type WeightEntry,
  type WorkoutLogEntry,
  type WorkoutPlanTemplate,
} from '@fittrack/shared';
import { useAuthStore } from './useAuthStore';
import { push } from '@/lib/sync';
import { buildScheduledWorkouts } from '@/lib/apply-plan';

function upsertByDate<T extends { date: string }>(history: T[], entry: T): T[] {
  const idx = history.findIndex((h) => h.date === entry.date);
  if (idx === -1) return [...history, entry];
  const next = [...history];
  next[idx] = entry;
  return next;
}

/**
 * The most recent weigh-in by date, not the most recently typed. With backfilling, filling in last
 * Tuesday must not make last Tuesday's weight the "current" one every target is computed from.
 */
function latestWeightKg(history: WeightEntry[]): number | undefined {
  let latest: WeightEntry | undefined;
  for (const w of history) if (!latest || w.date > latest.date) latest = w;
  return latest?.weightKg;
}

/** The signed-in user's id, or null when signed out — every sync push is a no-op until then. */
function currentUserId(): string | null {
  return useAuthStore.getState().session?.user.id ?? null;
}

interface AppState {
  profile: Profile | null;
  weightHistory: WeightEntry[];
  stepsHistory: StepsEntry[];
  sleepHistory: SleepEntry[];
  waterHistory: WaterEntry[];
  measurementsHistory: BodyMeasurementEntry[];
  foodEntries: FoodEntry[];
  scheduledWorkouts: ScheduledWorkout[];
  workoutLogs: WorkoutLogEntry[];
  progressPhotos: ProgressPhoto[];
  savedMeals: SavedMeal[];
  /**
   * Plans and "not now"s made from the insights card. Device-local on purpose: both are short-lived
   * (a deload lasts one session, a snooze a week) and losing one on a new phone costs a tap, which
   * isn't worth a table, a migration and a sync path each.
   */
  deloads: Deload[];
  insightSnoozes: Record<string, string>;
  /** Monday of the last weekly recap the user closed on Overview — so it shows once, not daily. */
  recapSeenWeek: string | null;

  setProfile: (profile: Profile) => void;
  /** Record a weigh-in (or steps, or sleep) for a day — today by default. */
  updateWeight: (weightKg: number, date?: string) => void;
  /** Remove a day's weigh-in — a typo, or a reading taken with clothes and shoes on. */
  removeWeight: (date: string) => void;
  updateSteps: (steps: number, date?: string) => void;
  updateSleep: (hours: number, date?: string) => void;
  /** Add to (or, with a negative amount, take back from) a day's water total — today by default. */
  addWater: (deltaMl: number, date?: string) => void;
  updateMeasurement: (fields: Omit<BodyMeasurementEntry, 'date'>) => void;

  addFoodEntry: (entry: Omit<FoodEntry, 'id' | 'loggedAt'>) => void;
  removeFoodEntry: (id: string) => void;
  /** Change servings or meal on an entry already logged. */
  updateFoodEntry: (id: string, patch: Partial<Pick<FoodEntry, 'quantity' | 'meal'>>) => void;
  /** Put back an entry just removed — same id, so the sync converges whether or not the delete
   * already reached the server. */
  restoreFoodEntry: (entry: FoodEntry) => void;

  setScheduledWorkouts: (workouts: ScheduledWorkout[]) => void;
  /** Lay a plan template out as this week's schedule and start counting its weeks from today. */
  applyPlan: (template: WorkoutPlanTemplate) => void;
  addWorkoutLog: (entry: Omit<WorkoutLogEntry, 'id'>) => void;
  /** Correct a session after the fact — a mistyped weight shouldn't mean re-entering the lot. */
  updateWorkoutLog: (id: string, patch: Partial<Omit<WorkoutLogEntry, 'id'>>) => void;
  removeWorkoutLog: (id: string) => void;
  restoreWorkoutLog: (entry: WorkoutLogEntry) => void;

  addProgressPhoto: (photo: Omit<ProgressPhoto, 'id'>) => string;
  removeProgressPhoto: (id: string) => void;

  addSavedMeal: (name: string, items: SavedMealItem[]) => void;
  removeSavedMeal: (id: string) => void;
  /** Put back a saved meal just deleted — same id, as with restoreFoodEntry. */
  restoreSavedMeal: (meal: SavedMeal) => void;
  logSavedMeal: (mealTemplateId: string, targetMeal: MealType, date?: string) => void;

  startDeload: (deload: Omit<Deload, 'createdOn'>) => void;
  cancelDeload: (exerciseId: string) => void;
  /** Hide an insight (by its key) for INSIGHT_SNOOZE_DAYS. */
  snoozeInsight: (key: string) => void;
  markRecapSeen: (weekStart: string) => void;

  /** Wipes all local state, e.g. after the account it belongs to has been deleted. Does not
   * touch the sync queue or Supabase — the caller is expected to have already deleted the
   * account server-side before calling this. */
  resetLocalData: () => void;
}

function emptyState(): Pick<
  AppState,
  | 'profile'
  | 'weightHistory'
  | 'stepsHistory'
  | 'sleepHistory'
  | 'waterHistory'
  | 'measurementsHistory'
  | 'foodEntries'
  | 'scheduledWorkouts'
  | 'workoutLogs'
  | 'progressPhotos'
  | 'savedMeals'
  | 'deloads'
  | 'insightSnoozes'
  | 'recapSeenWeek'
> {
  return {
    profile: null,
    weightHistory: [],
    stepsHistory: [],
    sleepHistory: [],
    waterHistory: [],
    measurementsHistory: [],
    foodEntries: [],
    scheduledWorkouts: [],
    workoutLogs: [],
    progressPhotos: [],
    savedMeals: [],
    deloads: [],
    insightSnoozes: {},
    recapSeenWeek: null,
  };
}

/** Deloads end themselves once a session at another weight is logged; drop the spent ones. */
function liveDeloads(deloads: Deload[], logs: WorkoutLogEntry[]): Deload[] {
  return deloads.filter((d) => isDeloadActive(d, logs));
}

function uid(): string {
  return randomUUID();
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...emptyState(),

      setProfile: (profile) => {
        // A weigh-in is recorded only when there's a weight to record: the first one, at
        // onboarding, or a weight the user actually changed. Saving Settings to switch goal or
        // units used to log "today: same as before" every time — a reading nobody took, which
        // flattens the trend the insights and measured maintenance are fitted through.
        const previous = get();
        const weighIn =
          previous.weightHistory.length === 0 || profile.weightKg !== previous.profile?.weightKg
            ? { date: todayISO(), weightKg: profile.weightKg }
            : null;
        set((state) => ({
          profile,
          weightHistory: weighIn ? upsertByDate(state.weightHistory, weighIn) : state.weightHistory,
        }));
        const userId = currentUserId();
        if (userId) {
          push.profile(userId, profile);
          if (weighIn) push.weight(userId, weighIn);
        }
      },

      updateWeight: (weightKg, date = todayISO()) => {
        set((state) => {
          const weightHistory = upsertByDate(state.weightHistory, { date, weightKg });
          return {
            weightHistory,
            profile: state.profile ? { ...state.profile, weightKg: latestWeightKg(weightHistory) ?? weightKg } : state.profile,
          };
        });
        const userId = currentUserId();
        if (userId) {
          push.weight(userId, { date, weightKg });
          const profile = get().profile;
          if (profile) push.profile(userId, profile);
        }
      },

      removeWeight: (date) => {
        set((state) => {
          const weightHistory = state.weightHistory.filter((w) => w.date !== date);
          // The current weight falls back to the latest reading that's left. With none left it
          // stays as it was — a profile always has a weight, and onboarding's is better than none.
          const latest = latestWeightKg(weightHistory);
          return {
            weightHistory,
            profile: state.profile && latest !== undefined ? { ...state.profile, weightKg: latest } : state.profile,
          };
        });
        const userId = currentUserId();
        if (userId) {
          push.deleteWeight(date);
          const profile = get().profile;
          if (profile) push.profile(userId, profile);
        }
      },

      updateSteps: (steps, date = todayISO()) => {
        set((state) => ({
          stepsHistory: upsertByDate(state.stepsHistory, { date, steps }),
        }));
        const userId = currentUserId();
        if (userId) push.steps(userId, { date, steps });
      },

      updateSleep: (hours, date = todayISO()) => {
        set((state) => ({
          sleepHistory: upsertByDate(state.sleepHistory, { date, hours }),
        }));
        const userId = currentUserId();
        if (userId) push.sleep(userId, { date, hours });
      },

      addWater: (deltaMl, date = todayISO()) => {
        const current = get().waterHistory.find((w) => w.date === date)?.ml ?? 0;
        // Floored at zero so an undo tapped once too often can't produce a negative day.
        const entry = { date, ml: Math.max(0, Math.round(current + deltaMl)) };
        set((state) => ({ waterHistory: upsertByDate(state.waterHistory, entry) }));
        // The day's running total is what's stored, so every write is idempotent and only the
        // latest matters: taps made while offline (or while a flush is in flight) collapse into
        // a single queued write, since the queue keeps only the newest op per key.
        const userId = currentUserId();
        if (userId) push.water(userId, entry);
      },

      updateMeasurement: (fields) => {
        const date = todayISO();
        set((state) => {
          const existing = state.measurementsHistory.find((m) => m.date === date);
          return {
            measurementsHistory: upsertByDate(state.measurementsHistory, { date, ...existing, ...fields }),
          };
        });
        const userId = currentUserId();
        if (userId) {
          const entry = get().measurementsHistory.find((m) => m.date === date);
          if (entry) push.measurement(userId, entry);
        }
      },

      addFoodEntry: (entry) => {
        const full = { ...entry, id: uid(), loggedAt: new Date().toISOString() };
        set((state) => ({ foodEntries: [...state.foodEntries, full] }));
        const userId = currentUserId();
        if (userId) push.foodEntry(userId, full);
      },

      removeFoodEntry: (id) => {
        set((state) => ({ foodEntries: state.foodEntries.filter((e) => e.id !== id) }));
        if (currentUserId()) push.deleteFoodEntry(id);
      },

      updateFoodEntry: (id, patch) => {
        let updated: FoodEntry | undefined;
        set((state) => ({
          foodEntries: state.foodEntries.map((e) => (e.id === id ? (updated = { ...e, ...patch }) : e)),
        }));
        const userId = currentUserId();
        if (userId && updated) push.foodEntry(userId, updated);
      },

      restoreFoodEntry: (entry) => {
        set((state) => ({
          foodEntries: state.foodEntries.some((e) => e.id === entry.id) ? state.foodEntries : [...state.foodEntries, entry],
        }));
        // The queue keeps only the newest op per row, so this upsert replaces a delete that hasn't
        // been sent yet — and recreates the row, under the same id, if it has.
        const userId = currentUserId();
        if (userId) push.foodEntry(userId, entry);
      },

      setScheduledWorkouts: (workouts) => {
        const previous = get().scheduledWorkouts;
        set({ scheduledWorkouts: workouts });
        const userId = currentUserId();
        if (userId) {
          const nextByDay = new Map(workouts.map((w) => [w.day, w]));
          const allDays = new Set([...previous.map((w) => w.day), ...workouts.map((w) => w.day)]);
          for (const day of allDays) {
            const next = nextByDay.get(day);
            if (next) push.scheduledWorkout(userId, next);
            else push.deleteScheduledWorkoutDay(day);
          }
        }
      },

      applyPlan: (template) => {
        // The schedule and the record of which plan it came from change together, so the Plans
        // tab can never show a week number for a plan that isn't the one laid out.
        get().setScheduledWorkouts(buildScheduledWorkouts(template));
        const profile = get().profile;
        if (!profile) return;
        const next = { ...profile, activePlan: { templateId: template.id, startedOn: todayISO() } };
        set({ profile: next });
        const userId = currentUserId();
        if (userId) push.profile(userId, next);
      },

      addWorkoutLog: (entry) => {
        const full = { ...entry, id: uid() };
        set((state) => {
          const workoutLogs = [...state.workoutLogs, full];
          return { workoutLogs, deloads: liveDeloads(state.deloads, workoutLogs) };
        });
        const userId = currentUserId();
        if (userId) push.workoutLog(userId, full);
      },

      updateWorkoutLog: (id, patch) => {
        let updated: WorkoutLogEntry | undefined;
        set((state) => ({
          workoutLogs: state.workoutLogs.map((e) => {
            if (e.id !== id) return e;
            updated = { ...e, ...patch };
            return updated;
          }),
        }));
        // The remote write is an upsert keyed on the same id, so an edit needs no plumbing of
        // its own — it's the identical push the original log made.
        const userId = currentUserId();
        if (userId && updated) push.workoutLog(userId, updated);
      },

      removeWorkoutLog: (id) => {
        set((state) => ({ workoutLogs: state.workoutLogs.filter((e) => e.id !== id) }));
        if (currentUserId()) push.deleteWorkoutLog(id);
      },

      restoreWorkoutLog: (entry) => {
        set((state) => ({
          workoutLogs: state.workoutLogs.some((e) => e.id === entry.id) ? state.workoutLogs : [...state.workoutLogs, entry],
        }));
        const userId = currentUserId();
        if (userId) push.workoutLog(userId, entry);
      },

      addProgressPhoto: (photo) => {
        const id = uid();
        const full = { ...photo, id };
        set((state) => ({ progressPhotos: [...state.progressPhotos, full] }));
        const userId = currentUserId();
        if (userId) {
          push.progressPhoto(userId, full);
          // The image file is already on disk (caller saves it before calling this) — upload it
          // and stamp the row's storage_path once that's done.
          void push.syncProgressPhotoFile(userId, full).catch(() => {});
        }
        return id;
      },

      removeProgressPhoto: (id) => {
        set((state) => ({ progressPhotos: state.progressPhotos.filter((p) => p.id !== id) }));
        const userId = currentUserId();
        if (userId) push.deleteProgressPhoto(userId, id);
      },

      addSavedMeal: (name, items) => {
        const full = { id: uid(), name, items, createdAt: new Date().toISOString() };
        set((state) => ({ savedMeals: [...state.savedMeals, full] }));
        const userId = currentUserId();
        if (userId) push.savedMeal(userId, full);
      },

      removeSavedMeal: (id) => {
        set((state) => ({ savedMeals: state.savedMeals.filter((m) => m.id !== id) }));
        if (currentUserId()) push.deleteSavedMeal(id);
      },

      restoreSavedMeal: (meal) => {
        set((state) => ({
          savedMeals: state.savedMeals.some((m) => m.id === meal.id) ? state.savedMeals : [...state.savedMeals, meal],
        }));
        const userId = currentUserId();
        if (userId) push.savedMeal(userId, meal);
      },

      logSavedMeal: (mealTemplateId, targetMeal, date = todayISO()) => {
        const meal = get().savedMeals.find((m) => m.id === mealTemplateId);
        if (!meal) return;
        const loggedAt = new Date().toISOString();
        const newEntries = meal.items.map((item) => ({
          ...item,
          id: uid(),
          date,
          meal: targetMeal,
          source: 'manual' as const,
          loggedAt,
        }));
        set((state) => ({ foodEntries: [...state.foodEntries, ...newEntries] }));
        const userId = currentUserId();
        if (userId) for (const entry of newEntries) push.foodEntry(userId, entry);
      },

      startDeload: (deload) => {
        set((state) => ({
          deloads: [
            ...state.deloads.filter((d) => d.exerciseId !== deload.exerciseId),
            { ...deload, createdOn: todayISO() },
          ],
        }));
      },

      cancelDeload: (exerciseId) => {
        set((state) => ({ deloads: state.deloads.filter((d) => d.exerciseId !== exerciseId) }));
      },

      snoozeInsight: (key) => {
        const today = todayISO();
        set((state) => {
          // Expired snoozes are dropped as new ones are added, so the map can't grow forever.
          const live = Object.fromEntries(Object.entries(state.insightSnoozes).filter(([, until]) => until > today));
          return { insightSnoozes: { ...live, [key]: addDaysISO(today, INSIGHT_SNOOZE_DAYS) } };
        });
      },

      markRecapSeen: (weekStart) => set({ recapSeenWeek: weekStart }),

      resetLocalData: () => set(emptyState()),
    }),
    {
      name: 'fitness-app-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
