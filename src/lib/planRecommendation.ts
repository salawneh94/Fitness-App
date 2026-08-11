import { PLAN_TEMPLATES } from '../data/planTemplates';
import type { Profile, WorkoutPlanTemplate } from '../types';

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
