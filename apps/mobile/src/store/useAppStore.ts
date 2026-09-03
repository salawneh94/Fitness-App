import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  todayISO,
  type BodyMeasurementEntry,
  type FoodEntry,
  type MealType,
  type Profile,
  type ProgressPhoto,
  type SavedMeal,
  type SavedMealItem,
  type ScheduledWorkout,
  type SleepEntry,
  type StepsEntry,
  type WeightEntry,
  type WorkoutLogEntry,
} from '@fittrack/shared';
import { useAuthStore } from './useAuthStore';
import { push } from '@/lib/sync';

function upsertByDate<T extends { date: string }>(history: T[], entry: T): T[] {
  const idx = history.findIndex((h) => h.date === entry.date);
  if (idx === -1) return [...history, entry];
  const next = [...history];
  next[idx] = entry;
  return next;
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
  measurementsHistory: BodyMeasurementEntry[];
  foodEntries: FoodEntry[];
  scheduledWorkouts: ScheduledWorkout[];
  workoutLogs: WorkoutLogEntry[];
  progressPhotos: ProgressPhoto[];
  savedMeals: SavedMeal[];

  setProfile: (profile: Profile) => void;
  updateWeight: (weightKg: number) => void;
  updateSteps: (steps: number) => void;
  updateSleep: (hours: number) => void;
  updateMeasurement: (fields: Omit<BodyMeasurementEntry, 'date'>) => void;

  addFoodEntry: (entry: Omit<FoodEntry, 'id' | 'loggedAt'>) => void;
  removeFoodEntry: (id: string) => void;

  setScheduledWorkouts: (workouts: ScheduledWorkout[]) => void;
  addWorkoutLog: (entry: Omit<WorkoutLogEntry, 'id'>) => void;
  removeWorkoutLog: (id: string) => void;

  addProgressPhoto: (photo: Omit<ProgressPhoto, 'id'>) => string;
  removeProgressPhoto: (id: string) => void;

  addSavedMeal: (name: string, items: SavedMealItem[]) => void;
  removeSavedMeal: (id: string) => void;
  logSavedMeal: (mealTemplateId: string, targetMeal: MealType) => void;

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
  | 'measurementsHistory'
  | 'foodEntries'
  | 'scheduledWorkouts'
  | 'workoutLogs'
  | 'progressPhotos'
  | 'savedMeals'
> {
  return {
    profile: null,
    weightHistory: [],
    stepsHistory: [],
    sleepHistory: [],
    measurementsHistory: [],
    foodEntries: [],
    scheduledWorkouts: [],
    workoutLogs: [],
    progressPhotos: [],
    savedMeals: [],
  };
}

function uid(): string {
  return randomUUID();
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...emptyState(),

      setProfile: (profile) => {
        set((state) => {
          const alreadyLogged = state.weightHistory.some((w) => w.date === todayISO());
          return {
            profile,
            weightHistory: alreadyLogged
              ? state.weightHistory
              : [...state.weightHistory, { date: todayISO(), weightKg: profile.weightKg }],
          };
        });
        const userId = currentUserId();
        if (userId) {
          push.profile(userId, profile);
          const entry = get().weightHistory.find((w) => w.date === todayISO());
          if (entry) push.weight(userId, entry);
        }
      },

      updateWeight: (weightKg) => {
        set((state) => ({
          weightHistory: upsertByDate(state.weightHistory, { date: todayISO(), weightKg }),
          profile: state.profile ? { ...state.profile, weightKg } : state.profile,
        }));
        const userId = currentUserId();
        if (userId) {
          push.weight(userId, { date: todayISO(), weightKg });
          const profile = get().profile;
          if (profile) push.profile(userId, profile);
        }
      },

      updateSteps: (steps) => {
        set((state) => ({
          stepsHistory: upsertByDate(state.stepsHistory, { date: todayISO(), steps }),
        }));
        const userId = currentUserId();
        if (userId) push.steps(userId, { date: todayISO(), steps });
      },

      updateSleep: (hours) => {
        set((state) => ({
          sleepHistory: upsertByDate(state.sleepHistory, { date: todayISO(), hours }),
        }));
        const userId = currentUserId();
        if (userId) push.sleep(userId, { date: todayISO(), hours });
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

      addWorkoutLog: (entry) => {
        const full = { ...entry, id: uid() };
        set((state) => ({ workoutLogs: [...state.workoutLogs, full] }));
        const userId = currentUserId();
        if (userId) push.workoutLog(userId, full);
      },

      removeWorkoutLog: (id) => {
        set((state) => ({ workoutLogs: state.workoutLogs.filter((e) => e.id !== id) }));
        if (currentUserId()) push.deleteWorkoutLog(id);
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

      logSavedMeal: (mealTemplateId, targetMeal) => {
        const meal = get().savedMeals.find((m) => m.id === mealTemplateId);
        if (!meal) return;
        const date = todayISO();
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

      resetLocalData: () => set(emptyState()),
    }),
    {
      name: 'fitness-app-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
