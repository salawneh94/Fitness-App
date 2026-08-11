import type { Exercise } from '../types';

// Video demos link to a YouTube search for the exercise + "proper form tutorial"
// rather than a specific hardcoded video ID, since we can't guarantee any single
// video ID stays valid/accurate. Users get a results page of vetted-by-them content.
function demoSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' proper form tutorial')}`;
}

export const EXERCISE_LIBRARY: Exercise[] = [
  { id: 'bench-press', name: 'Barbell Bench Press', category: 'chest', equipment: 'Barbell', videoUrl: demoSearchUrl('barbell bench press'), sets: 4, reps: '6-10' },
  { id: 'incline-db-press', name: 'Incline Dumbbell Press', category: 'chest', equipment: 'Dumbbells', videoUrl: demoSearchUrl('incline dumbbell press'), sets: 3, reps: '8-12' },
  { id: 'push-up', name: 'Push-Up', category: 'chest', equipment: 'Bodyweight', videoUrl: demoSearchUrl('push up'), sets: 3, reps: '12-20' },
  { id: 'dips', name: 'Chest Dips', category: 'chest', equipment: 'Dip Bars', videoUrl: demoSearchUrl('chest dips'), sets: 3, reps: '8-12' },

  { id: 'deadlift', name: 'Conventional Deadlift', category: 'back', equipment: 'Barbell', videoUrl: demoSearchUrl('conventional deadlift'), sets: 3, reps: '4-6' },
  { id: 'pull-up', name: 'Pull-Up', category: 'back', equipment: 'Pull-up Bar', videoUrl: demoSearchUrl('pull up'), sets: 4, reps: '6-12' },
  { id: 'barbell-row', name: 'Barbell Row', category: 'back', equipment: 'Barbell', videoUrl: demoSearchUrl('barbell row'), sets: 4, reps: '8-10' },
  { id: 'lat-pulldown', name: 'Lat Pulldown', category: 'back', equipment: 'Cable Machine', videoUrl: demoSearchUrl('lat pulldown'), sets: 3, reps: '10-12' },

  { id: 'ohp', name: 'Overhead Press', category: 'shoulders', equipment: 'Barbell', videoUrl: demoSearchUrl('barbell overhead press'), sets: 4, reps: '6-10' },
  { id: 'lateral-raise', name: 'Dumbbell Lateral Raise', category: 'shoulders', equipment: 'Dumbbells', videoUrl: demoSearchUrl('dumbbell lateral raise'), sets: 3, reps: '12-15' },
  { id: 'face-pull', name: 'Face Pull', category: 'shoulders', equipment: 'Cable/Band', videoUrl: demoSearchUrl('cable face pull'), sets: 3, reps: '15-20' },

  { id: 'barbell-curl', name: 'Barbell Bicep Curl', category: 'arms', equipment: 'Barbell', videoUrl: demoSearchUrl('barbell bicep curl'), sets: 3, reps: '10-12' },
  { id: 'tricep-pushdown', name: 'Tricep Pushdown', category: 'arms', equipment: 'Cable Machine', videoUrl: demoSearchUrl('tricep pushdown'), sets: 3, reps: '10-15' },
  { id: 'hammer-curl', name: 'Hammer Curl', category: 'arms', equipment: 'Dumbbells', videoUrl: demoSearchUrl('hammer curl'), sets: 3, reps: '10-12' },

  { id: 'squat', name: 'Barbell Back Squat', category: 'legs', equipment: 'Barbell', videoUrl: demoSearchUrl('barbell back squat'), sets: 4, reps: '5-8' },
  { id: 'leg-press', name: 'Leg Press', category: 'legs', equipment: 'Machine', videoUrl: demoSearchUrl('leg press machine'), sets: 3, reps: '10-15' },
  { id: 'lunge', name: 'Walking Lunge', category: 'legs', equipment: 'Dumbbells', videoUrl: demoSearchUrl('walking lunge'), sets: 3, reps: '10-12/leg' },
  { id: 'leg-curl', name: 'Lying Leg Curl', category: 'legs', equipment: 'Machine', videoUrl: demoSearchUrl('lying leg curl machine'), sets: 3, reps: '10-12' },
  { id: 'calf-raise', name: 'Standing Calf Raise', category: 'legs', equipment: 'Machine', videoUrl: demoSearchUrl('standing calf raise'), sets: 4, reps: '12-15' },

  { id: 'hip-thrust', name: 'Barbell Hip Thrust', category: 'glutes', equipment: 'Barbell', videoUrl: demoSearchUrl('barbell hip thrust'), sets: 4, reps: '8-12' },
  { id: 'rdl', name: 'Romanian Deadlift', category: 'glutes', equipment: 'Barbell', videoUrl: demoSearchUrl('romanian deadlift'), sets: 3, reps: '8-10' },

  { id: 'plank', name: 'Plank', category: 'core', equipment: 'Bodyweight', videoUrl: demoSearchUrl('plank exercise'), sets: 3, reps: '30-60s' },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', category: 'core', equipment: 'Pull-up Bar', videoUrl: demoSearchUrl('hanging leg raise'), sets: 3, reps: '10-15' },
  { id: 'russian-twist', name: 'Russian Twist', category: 'core', equipment: 'Bodyweight/Plate', videoUrl: demoSearchUrl('russian twist'), sets: 3, reps: '20 total' },

  { id: 'running', name: 'Steady-State Running', category: 'cardio', equipment: 'None', videoUrl: demoSearchUrl('running form technique'), notes: '20-30 min moderate pace' },
  { id: 'jump-rope', name: 'Jump Rope', category: 'cardio', equipment: 'Jump Rope', videoUrl: demoSearchUrl('jump rope technique'), notes: '10-15 min intervals' },
  { id: 'burpee', name: 'Burpee', category: 'full_body', equipment: 'Bodyweight', videoUrl: demoSearchUrl('burpee'), sets: 3, reps: '10-15' },
  { id: 'kettlebell-swing', name: 'Kettlebell Swing', category: 'full_body', equipment: 'Kettlebell', videoUrl: demoSearchUrl('kettlebell swing'), sets: 3, reps: '15-20' },
];

export function findExercise(id: string): Exercise | undefined {
  return EXERCISE_LIBRARY.find((e) => e.id === id);
}
