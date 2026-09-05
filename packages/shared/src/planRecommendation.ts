import { PLAN_TEMPLATES } from './data/planTemplates';
import type { Profile, Weekday, WorkoutPlanTemplate } from './types';

const WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Spreads a plan's training days across the week instead of stacking them at the front.
 *
 * Assigning day i to weekday i put the 3-day full-body plan on Mon/Tue/Wed — three
 * consecutive full-body sessions with no recovery, which is both bad programming and enough
 * to trip the app's own overtraining nudge. Rounding i * 7 / count keeps the gaps even
 * (3 days → Mon/Wed/Sat, 4 → Mon/Wed/Fri/Sat, 6 → everything but Thursday). The step is
 * 7 / count ≥ 1 for any plan of 7 days or fewer, so the indices never collide.
 */
export function planWeekdays(dayCount: number): Weekday[] {
  const count = Math.min(dayCount, WEEKDAYS.length);
  return Array.from({ length: count }, (_, i) => WEEKDAYS[Math.round((i * WEEKDAYS.length) / count)]);
}

export function recommendPlan(profile: Profile): { template: WorkoutPlanTemplate; reason: string } {
  const candidates = PLAN_TEMPLATES.filter((t) => t.goals.includes(profile.goal));
  const pool = candidates.length > 0 ? candidates : PLAN_TEMPLATES;

  const best = pool.reduce((closest, t) => {
    const diff = Math.abs(t.daysPerWeek - profile.preferredDaysPerWeek);
    const closestDiff = Math.abs(closest.daysPerWeek - profile.preferredDaysPerWeek);
    return diff < closestDiff ? t : closest;
  }, pool[0]);

  const goalLabel = profile.goal.replace('_', ' ');
  const reason =
    best.daysPerWeek === profile.preferredDaysPerWeek
      ? `Matches your goal (${goalLabel}) and fits your ${profile.preferredDaysPerWeek} day/week availability exactly.`
      : `Best fit for your goal (${goalLabel}) — closest match to your ${profile.preferredDaysPerWeek} day/week availability at ${best.daysPerWeek} days/week.`;

  return { template: best, reason };
}
