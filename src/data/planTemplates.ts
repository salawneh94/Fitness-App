import type { WorkoutPlanTemplate } from '../types';
import { EXERCISE_LIBRARY, findExercise } from './exercises';

function ex(id: string) {
  const e = findExercise(id);
  if (!e) throw new Error(`Unknown exercise id: ${id}`);
  return e;
}

export const PLAN_TEMPLATES: WorkoutPlanTemplate[] = [
  {
    id: 'upper-lower',
    name: 'Upper / Lower Split',
    split: 'Upper / Lower',
    description: 'A balanced 4-day split alternating upper and lower body — great for strength and hypertrophy with solid recovery time.',
    daysPerWeek: 4,
    days: [
      { label: 'Day 1', focus: 'Upper Body (Strength)', exercises: [ex('bench-press'), ex('barbell-row'), ex('ohp'), ex('pull-up'), ex('barbell-curl')] },
      { label: 'Day 2', focus: 'Lower Body (Strength)', exercises: [ex('squat'), ex('rdl'), ex('leg-press'), ex('calf-raise'), ex('plank')] },
      { label: 'Day 3', focus: 'Upper Body (Hypertrophy)', exercises: [ex('incline-db-press'), ex('lat-pulldown'), ex('lateral-raise'), ex('tricep-pushdown'), ex('hammer-curl')] },
      { label: 'Day 4', focus: 'Lower Body (Hypertrophy)', exercises: [ex('hip-thrust'), ex('lunge'), ex('leg-curl'), ex('calf-raise'), ex('russian-twist')] },
    ],
  },
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    split: 'Push / Pull / Legs',
    description: 'A classic 6-day (or 3-day repeated) split grouping muscles by movement pattern — high volume for serious muscle growth.',
    daysPerWeek: 6,
    days: [
      { label: 'Day 1', focus: 'Push (Chest, Shoulders, Triceps)', exercises: [ex('bench-press'), ex('ohp'), ex('incline-db-press'), ex('lateral-raise'), ex('tricep-pushdown')] },
      { label: 'Day 2', focus: 'Pull (Back, Biceps)', exercises: [ex('deadlift'), ex('pull-up'), ex('barbell-row'), ex('face-pull'), ex('barbell-curl')] },
      { label: 'Day 3', focus: 'Legs', exercises: [ex('squat'), ex('rdl'), ex('leg-press'), ex('leg-curl'), ex('calf-raise')] },
      { label: 'Day 4', focus: 'Push (Volume)', exercises: [ex('dips'), ex('incline-db-press'), ex('lateral-raise'), ex('tricep-pushdown')] },
      { label: 'Day 5', focus: 'Pull (Volume)', exercises: [ex('barbell-row'), ex('lat-pulldown'), ex('face-pull'), ex('hammer-curl')] },
      { label: 'Day 6', focus: 'Legs (Volume)', exercises: [ex('hip-thrust'), ex('lunge'), ex('leg-curl'), ex('calf-raise')] },
    ],
  },
  {
    id: 'full-body',
    name: 'Full Body 3-Day',
    split: 'Full Body',
    description: 'Efficient full-body sessions 3x/week — ideal for beginners or anyone with limited gym time who still wants complete coverage.',
    daysPerWeek: 3,
    days: [
      { label: 'Day 1', focus: 'Full Body A', exercises: [ex('squat'), ex('bench-press'), ex('barbell-row'), ex('plank')] },
      { label: 'Day 2', focus: 'Full Body B', exercises: [ex('deadlift'), ex('ohp'), ex('pull-up'), ex('russian-twist')] },
      { label: 'Day 3', focus: 'Full Body C', exercises: [ex('leg-press'), ex('incline-db-press'), ex('lat-pulldown'), ex('hanging-leg-raise')] },
    ],
  },
  {
    id: 'bro-split',
    name: 'Classic Bodybuilding Split',
    split: 'Bro Split',
    description: 'One muscle group per day across 5 days — maximum focused volume per body part, popular for dedicated hypertrophy training.',
    daysPerWeek: 5,
    days: [
      { label: 'Day 1', focus: 'Chest', exercises: [ex('bench-press'), ex('incline-db-press'), ex('dips'), ex('push-up')] },
      { label: 'Day 2', focus: 'Back', exercises: [ex('deadlift'), ex('pull-up'), ex('barbell-row'), ex('lat-pulldown')] },
      { label: 'Day 3', focus: 'Shoulders', exercises: [ex('ohp'), ex('lateral-raise'), ex('face-pull')] },
      { label: 'Day 4', focus: 'Legs', exercises: [ex('squat'), ex('rdl'), ex('leg-press'), ex('calf-raise')] },
      { label: 'Day 5', focus: 'Arms & Core', exercises: [ex('barbell-curl'), ex('tricep-pushdown'), ex('hammer-curl'), ex('plank')] },
    ],
  },
  {
    id: 'home-bodyweight',
    name: 'Home Bodyweight Plan',
    split: 'Full Body (No Equipment)',
    description: 'No gym, no problem — a 3-day bodyweight-only routine you can do anywhere.',
    daysPerWeek: 3,
    days: [
      { label: 'Day 1', focus: 'Push & Core', exercises: [ex('push-up'), ex('dips'), ex('plank'), ex('burpee')] },
      { label: 'Day 2', focus: 'Pull & Legs', exercises: [ex('pull-up'), ex('lunge'), ex('russian-twist')] },
      { label: 'Day 3', focus: 'Conditioning', exercises: [ex('burpee'), ex('jump-rope'), ex('hanging-leg-raise'), ex('running')] },
    ],
  },
  {
    id: 'cardio-conditioning',
    name: 'Cardio & Conditioning',
    split: 'Endurance',
    description: 'Built for endurance and fat-loss goals — mixes steady-state and interval work with light full-body strength.',
    daysPerWeek: 4,
    days: [
      { label: 'Day 1', focus: 'Steady Cardio', exercises: [ex('running')] },
      { label: 'Day 2', focus: 'Full Body Strength', exercises: [ex('squat'), ex('push-up'), ex('barbell-row'), ex('plank')] },
      { label: 'Day 3', focus: 'HIIT Intervals', exercises: [ex('burpee'), ex('jump-rope'), ex('kettlebell-swing')] },
      { label: 'Day 4', focus: 'Active Recovery / Core', exercises: [ex('plank'), ex('russian-twist'), ex('hanging-leg-raise')] },
    ],
  },
];

export { EXERCISE_LIBRARY };
