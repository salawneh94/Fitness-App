import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  FoodEntry,
  Profile,
  ScheduledWorkout,
  WeightEntry,
  WorkoutLogEntry,
} from '../types';
import { todayISO } from '../lib/calc';

interface AppState {
  profile: Profile | null;
  weightHistory: WeightEntry[];
  foodEntries: FoodEntry[];
  scheduledWorkouts: ScheduledWorkout[];
  workoutLogs: WorkoutLogEntry[];

  setProfile: (profile: Profile) => void;
  updateWeight: (weightKg: number) => void;

  addFoodEntry: (entry: Omit<FoodEntry, 'id' | 'loggedAt'>) => void;
  removeFoodEntry: (id: string) => void;

  setScheduledWorkouts: (workouts: ScheduledWorkout[]) => void;
  addWorkoutLog: (entry: Omit<WorkoutLogEntry, 'id'>) => void;
  removeWorkoutLog: (id: string) => void;
}

function uid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      profile: null,
      weightHistory: [],
      foodEntries: [],
      scheduledWorkouts: [],
      workoutLogs: [],

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
        set((state) => {
          const date = todayISO();
          const existingIdx = state.weightHistory.findIndex((w) => w.date === date);
          const history = [...state.weightHistory];
          if (existingIdx >= 0) history[existingIdx] = { date, weightKg };
          else history.push({ date, weightKg });
          return {
            weightHistory: history,
            profile: state.profile ? { ...state.profile, weightKg } : state.profile,
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
    }),
    { name: 'fitness-app-storage' }
  )
);
