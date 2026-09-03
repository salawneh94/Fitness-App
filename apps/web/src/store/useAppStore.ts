import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  BodyMeasurementEntry,
  FoodEntry,
  MealType,
  Profile,
  ProgressPhoto,
  SavedMeal,
  SavedMealItem,
  ScheduledWorkout,
  SleepEntry,
  StepsEntry,
  WeightEntry,
  WorkoutLogEntry,
} from '@fittrack/shared';
import { todayISO } from '@fittrack/shared';

function upsertByDate<T extends { date: string }>(history: T[], entry: T): T[] {
  const idx = history.findIndex((h) => h.date === entry.date);
  if (idx === -1) return [...history, entry];
  const next = [...history];
  next[idx] = entry;
  return next;
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
}

function uid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
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

      setProfile: (profile) =>
        set((state) => {
          const alreadyLogged = state.weightHistory.some((w) => w.date === todayISO());
          return {
            profile,
            weightHistory: alreadyLogged
              ? state.weightHistory
              : [...state.weightHistory, { date: todayISO(), weightKg: profile.weightKg }],
          };
        }),

      updateWeight: (weightKg) =>
        set((state) => ({
          weightHistory: upsertByDate(state.weightHistory, { date: todayISO(), weightKg }),
          profile: state.profile ? { ...state.profile, weightKg } : state.profile,
        })),

      updateSteps: (steps) =>
        set((state) => ({
          stepsHistory: upsertByDate(state.stepsHistory, { date: todayISO(), steps }),
        })),

      updateSleep: (hours) =>
        set((state) => ({
          sleepHistory: upsertByDate(state.sleepHistory, { date: todayISO(), hours }),
        })),

      updateMeasurement: (fields) =>
        set((state) => {
          const date = todayISO();
          const existing = state.measurementsHistory.find((m) => m.date === date);
          return {
            measurementsHistory: upsertByDate(state.measurementsHistory, { date, ...existing, ...fields }),
          };
        }),

      addFoodEntry: (entry) =>
        set((state) => ({
          foodEntries: [
            ...state.foodEntries,
            { ...entry, id: uid(), loggedAt: new Date().toISOString() },
          ],
        })),

      removeFoodEntry: (id) =>
        set((state) => ({ foodEntries: state.foodEntries.filter((e) => e.id !== id) })),

      setScheduledWorkouts: (workouts) => set({ scheduledWorkouts: workouts }),

      addWorkoutLog: (entry) =>
        set((state) => ({
          workoutLogs: [...state.workoutLogs, { ...entry, id: uid() }],
        })),

      removeWorkoutLog: (id) =>
        set((state) => ({ workoutLogs: state.workoutLogs.filter((e) => e.id !== id) })),

      addProgressPhoto: (photo) => {
        const id = uid();
        set((state) => ({ progressPhotos: [...state.progressPhotos, { ...photo, id }] }));
        return id;
      },

      removeProgressPhoto: (id) =>
        set((state) => ({ progressPhotos: state.progressPhotos.filter((p) => p.id !== id) })),

      addSavedMeal: (name, items) =>
        set((state) => ({
          savedMeals: [
            ...state.savedMeals,
            { id: uid(), name, items, createdAt: new Date().toISOString() },
          ],
        })),

      removeSavedMeal: (id) =>
        set((state) => ({ savedMeals: state.savedMeals.filter((m) => m.id !== id) })),

      logSavedMeal: (mealTemplateId, targetMeal) => {
        const meal = get().savedMeals.find((m) => m.id === mealTemplateId);
        if (!meal) return;
        const date = todayISO();
        const loggedAt = new Date().toISOString();
        set((state) => ({
          foodEntries: [
            ...state.foodEntries,
            ...meal.items.map((item) => ({
              ...item,
              id: uid(),
              date,
              meal: targetMeal,
              source: 'manual' as const,
              loggedAt,
            })),
          ],
        }));
      },
    }),
    { name: 'fitness-app-storage' }
  )
);
