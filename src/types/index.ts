export type Sex = 'male' | 'female' | 'other';

export type Goal = 'lose_fat' | 'maintain' | 'build_muscle' | 'improve_endurance' | 'general_health';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface Profile {
  name: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  goal: Goal;
  targetWeightKg?: number;
  timeframeWeeks: number;
  expectations: string;
  activityLevel: ActivityLevel;
  createdAt: string;
}

export interface WeightEntry {
  date: string; // ISO date
  weightKg: number;
}

export interface Micronutrients {
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
  potassiumMg?: number;
  cholesterolMg?: number;
  vitaminAMcg?: number;
  vitaminCMg?: number;
  vitaminDMcg?: number;
  calciumMg?: number;
  ironMg?: number;
  vitaminB12Mcg?: number;
  magnesiumMg?: number;
  zincMg?: number;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodEntry {
  id: string;
  date: string; // ISO date (day)
  meal: MealType;
  name: string;
  brand?: string;
  quantity: number; // servings
  servingLabel?: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  micros?: Micronutrients;
  source: 'manual' | 'barcode';
  barcode?: string;
  loggedAt: string;
}

export interface DailyTargets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export type ExerciseCategory =
  | 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'glutes' | 'core' | 'cardio' | 'full_body';

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  equipment: string;
  videoUrl: string; // YouTube embed URL
  sets?: number;
  reps?: string;
  notes?: string;
}

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface ScheduledWorkout {
  id: string;
  day: Weekday;
  name: string;
  exercises: Exercise[];
}

export interface WorkoutLogEntry {
  id: string;
  date: string; // ISO date
  workoutName: string;
  durationMin: number;
  caloriesBurned?: number;
  notes?: string;
}

export interface WorkoutPlanTemplate {
  id: string;
  name: string;
  split: string; // e.g. "Upper/Lower", "Push/Pull/Legs"
  description: string;
  daysPerWeek: number;
  days: { label: string; focus: string; exercises: Exercise[] }[];
}
