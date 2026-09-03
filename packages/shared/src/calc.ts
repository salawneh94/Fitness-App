import type { ActivityLevel, DailyTargets, Goal, Profile } from './types';

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

/** Energy in roughly a kilogram of body mass — the standard figure for planning a rate change. */
const KCAL_PER_KG = 7700;

/**
 * Safety rails on how fast the plan will try to move, as a fraction of bodyweight per week.
 * Losing faster than ~1%/wk costs lean mass; gaining faster than ~0.5%/wk is mostly fat.
 */
const MAX_LOSS_RATE_PER_WEEK = 0.01;
const MAX_GAIN_RATE_PER_WEEK = 0.005;

/** Never recommend eating below this, regardless of what the requested timeline implies. */
function calorieFloor(profile: Profile): number {
  const absolute = profile.sex === 'female' ? 1200 : 1500;
  return Math.max(calcBMR(profile), absolute);
}

export interface TargetPlan extends DailyTargets {
  tdee: number;
  /** Weekly kg change the user's target + timeframe actually asks for (negative = loss). */
  requestedWeeklyRateKg: number;
  /** What the plan will actually aim for after safety limits. */
  appliedWeeklyRateKg: number;
  /** True when the requested pace was too aggressive and got limited. */
  rateWasCapped: boolean;
  /** True when the calories needed for that pace fell below the safe floor. */
  hitCalorieFloor: boolean;
  /** Realistic weeks to reach the target at the applied rate, when one applies. */
  projectedWeeks: number | null;
}

/**
 * Build the daily calorie and macro plan.
 *
 * The calorie number is driven by the user's actual target: how much weight they want to change
 * and over how long. Previously targetWeightKg and timeframeWeeks were collected and displayed
 * but never used, so editing either changed nothing — and three of the five goals shared the same
 * adjustment, so switching between those changed nothing either.
 *
 * When there's no meaningful weight target (target equals current, or it's missing), it falls back
 * to the goal's generic adjustment so the number is still sensible.
 */
export function planDailyTargets(profile: Profile): TargetPlan {
  const tdee = calcTDEE(profile);
  const floor = calorieFloor(profile);

  const target = profile.targetWeightKg;
  const weeks = profile.timeframeWeeks;
  const deltaKg = target != null && target > 0 ? target - profile.weightKg : 0;
  const hasWeightTarget = Math.abs(deltaKg) >= 0.5 && weeks > 0;

  let requestedWeeklyRateKg = 0;
  let appliedWeeklyRateKg = 0;
  let calories: number;
  let rateWasCapped = false;

  if (hasWeightTarget) {
    requestedWeeklyRateKg = deltaKg / weeks;

    const maxLoss = profile.weightKg * MAX_LOSS_RATE_PER_WEEK;
    const maxGain = profile.weightKg * MAX_GAIN_RATE_PER_WEEK;
    appliedWeeklyRateKg = Math.max(-maxLoss, Math.min(maxGain, requestedWeeklyRateKg));
    rateWasCapped = Math.abs(appliedWeeklyRateKg - requestedWeeklyRateKg) > 0.005;

    const dailyDelta = (appliedWeeklyRateKg * KCAL_PER_KG) / 7;
    calories = tdee + dailyDelta;
  } else {
    calories = tdee * (1 + GOAL_ADJUSTMENT[profile.goal]);
    appliedWeeklyRateKg = ((calories - tdee) * 7) / KCAL_PER_KG;
    requestedWeeklyRateKg = appliedWeeklyRateKg;
  }

  const hitCalorieFloor = calories < floor;
  if (hitCalorieFloor) {
    calories = floor;
    appliedWeeklyRateKg = ((calories - tdee) * 7) / KCAL_PER_KG;
  }

  calories = Math.round(calories);

  const projectedWeeks =
    hasWeightTarget && Math.abs(appliedWeeklyRateKg) > 0.001
      ? Math.ceil(Math.abs(deltaKg / appliedWeeklyRateKg))
      : null;

  const { proteinPerKg, fatPct } = GOAL_MACROS[profile.goal];
  const proteinG = Math.round(profile.weightKg * proteinPerKg);
  const fatG = Math.round((calories * fatPct) / 9);
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));

  return {
    calories,
    proteinG,
    carbsG,
    fatG,
    tdee: Math.round(tdee),
    requestedWeeklyRateKg,
    appliedWeeklyRateKg,
    rateWasCapped,
    hitCalorieFloor,
    projectedWeeks,
  };
}

export function calcDailyTargets(profile: Profile): DailyTargets {
  const { calories, proteinG, carbsG, fatG } = planDailyTargets(profile);
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

/**
 * Format a Date as a YYYY-MM-DD *calendar* date in the user's own timezone.
 *
 * Deliberately not `toISOString().slice(0, 10)`: that converts to UTC first, so anyone east of
 * Greenwich gets the previous day's date for part of every evening, and anyone west of it gets
 * tomorrow's for part of every morning — meals and workouts would land on the wrong day.
 */
export function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/**
 * Add (or subtract) whole days to a YYYY-MM-DD calendar date.
 *
 * All arithmetic happens in UTC so the result depends only on the input string, never on the
 * device's timezone. Doing this in local time is a trap: `new Date('2026-08-24T00:00:00')` is
 * parsed as local midnight, and converting the result back with `toISOString()` reinterprets it
 * as UTC — so at UTC+3, adding a day returns *the same date string*. Any loop advancing a cursor
 * with it then never terminates and freezes the tab.
 */
/**
 * Turn a YYYY-MM-DD calendar date into a Date at local midnight, for display formatting.
 *
 * `new Date('2026-08-24')` is specified to parse as UTC midnight, which then renders as the
 * previous day for anyone west of Greenwich — so build the date from its parts instead.
 */
export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDaysISO(iso: string, delta: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Epley formula — a widely used estimate of 1-rep max from a submaximal set.
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export const STEP_GOAL = 10000;
export const SLEEP_GOAL_HOURS = 8;
