import type { ActivityLevel, DailyTargets, Goal, Profile } from '../types';

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Mifflin-St Jeor
export function calcBMR(profile: Profile): number {
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
  if (profile.sex === 'male') return base + 5;
  if (profile.sex === 'female') return base - 161;
  return base - 78; // 'other' — midpoint approximation
}

export function calcTDEE(profile: Profile): number {
  return calcBMR(profile) * ACTIVITY_MULTIPLIER[profile.activityLevel];
}

const GOAL_ADJUSTMENT: Record<Goal, number> = {
  lose_fat: -0.2,
  build_muscle: 0.12,
  maintain: 0,
  improve_endurance: 0,
  general_health: 0,
};

const GOAL_MACROS: Record<Goal, { proteinPerKg: number; fatPct: number }> = {
  lose_fat: { proteinPerKg: 2.0, fatPct: 0.3 },
  build_muscle: { proteinPerKg: 1.8, fatPct: 0.25 },
  maintain: { proteinPerKg: 1.6, fatPct: 0.3 },
  improve_endurance: { proteinPerKg: 1.4, fatPct: 0.25 },
  general_health: { proteinPerKg: 1.4, fatPct: 0.3 },
};

export function calcDailyTargets(profile: Profile): DailyTargets {
  const tdee = calcTDEE(profile);
  const calories = Math.round(tdee * (1 + GOAL_ADJUSTMENT[profile.goal]));
  const { proteinPerKg, fatPct } = GOAL_MACROS[profile.goal];
  const proteinG = Math.round(profile.weightKg * proteinPerKg);
  const fatG = Math.round((calories * fatPct) / 9);
  const proteinCals = proteinG * 4;
  const fatCals = fatG * 9;
  const carbsG = Math.max(0, Math.round((calories - proteinCals - fatCals) / 4));
  return { calories, proteinG, carbsG, fatG };
}

export function bmi(profile: Profile): number {
  const heightM = profile.heightCm / 100;
  return profile.weightKg / (heightM * heightM);
}

export const GOAL_LABELS: Record<Goal, string> = {
  lose_fat: 'Lose Fat',
  maintain: 'Maintain Weight',
  build_muscle: 'Build Muscle',
  improve_endurance: 'Improve Endurance',
  general_health: 'General Health',
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (little to no exercise)',
  light: 'Light (1-3 days/week)',
  moderate: 'Moderate (3-5 days/week)',
  active: 'Active (6-7 days/week)',
  very_active: 'Very Active (physical job / 2x day)',
};

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Epley formula — a widely used estimate of 1-rep max from a submaximal set.
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}
