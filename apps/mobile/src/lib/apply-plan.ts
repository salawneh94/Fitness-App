import { randomUUID } from 'expo-crypto';
import type { ScheduledWorkout, WorkoutPlanTemplate } from '@fittrack/shared';
import { planWeekdays } from '@fittrack/shared';

/**
 * Turns a plan template into a week of scheduled workouts.
 *
 * Lives here rather than in @fittrack/shared because the ids come from expo-crypto; the
 * weekday assignment itself is shared logic. Both the Plans tab and the end of onboarding go
 * through this, so a plan the user picks and the plan we seed at signup are built identically.
 */
export function buildScheduledWorkouts(template: WorkoutPlanTemplate): ScheduledWorkout[] {
  const days = template.days.slice(0, 7);
  const weekdays = planWeekdays(days.length);
  return days.map((d, i) => ({
    id: randomUUID(),
    // The template's label is just "Day 1", which the weekday on the card already tells you —
    // and prefixing it pushed the part that actually distinguishes the session ("Upper Body
    // (Strength)") past the truncation point.
    day: weekdays[i],
    name: d.focus,
    exercises: d.exercises,
  }));
}
