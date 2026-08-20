import type { Exercise } from '../types';

// Video demos link to a YouTube search for the exercise + "proper form tutorial"
// as a fallback, since we can't guarantee any single video ID stays valid forever.
// Where possible, videoId below points to a specific tutorial verified via live
// search (title + reputable source, e.g. NASM) so it can be embedded in-app —
// never hand-picked from memory, since a wrong/hallucinated ID showing incorrect
// exercise form is a real injury risk, not just a broken link.
function demoSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' proper form tutorial')}`;
}

export const EXERCISE_LIBRARY: Exercise[] = [
  { id: 'bench-press', name: 'Barbell Bench Press', category: 'chest', equipment: 'Barbell', videoUrl: demoSearchUrl('barbell bench press'), videoId: 'Pp8rHcFVIYg', sets: 4, reps: '6-10' },
  { id: 'incline-db-press', name: 'Incline Dumbbell Press', category: 'chest', equipment: 'Dumbbells', videoUrl: demoSearchUrl('incline dumbbell press'), videoId: 'awEEyL5zGvU', sets: 3, reps: '8-12' },
  { id: 'push-up', name: 'Push-Up', category: 'chest', equipment: 'Bodyweight', videoUrl: demoSearchUrl('push up'), videoId: 'WDIpL0pjun0', sets: 3, reps: '12-20' },
  { id: 'dips', name: 'Chest Dips', category: 'chest', equipment: 'Dip Bars', videoUrl: demoSearchUrl('chest dips'), videoId: 'yN6Q1UI_xkE', sets: 3, reps: '8-12' },

  { id: 'deadlift', name: 'Conventional Deadlift', category: 'back', equipment: 'Barbell', videoUrl: demoSearchUrl('conventional deadlift'), videoId: 'GxsLrTzyGUU', sets: 3, reps: '4-6' },
  { id: 'pull-up', name: 'Pull-Up', category: 'back', equipment: 'Pull-up Bar', videoUrl: demoSearchUrl('pull up'), videoId: 'nfCHD8i8UI4', sets: 4, reps: '6-12' },
  { id: 'barbell-row', name: 'Barbell Row', category: 'back', equipment: 'Barbell', videoUrl: demoSearchUrl('barbell row'), videoId: 'gScFsUWwFmc', sets: 4, reps: '8-10' },
  { id: 'lat-pulldown', name: 'Lat Pulldown', category: 'back', equipment: 'Cable Machine', videoUrl: demoSearchUrl('lat pulldown'), videoId: 'SALxEARiMkw', sets: 3, reps: '10-12' },

  { id: 'ohp', name: 'Overhead Press', category: 'shoulders', equipment: 'Barbell', videoUrl: demoSearchUrl('barbell overhead press'), videoId: 'a81SaIpjGlA', sets: 4, reps: '6-10' },
  { id: 'lateral-raise', name: 'Dumbbell Lateral Raise', category: 'shoulders', equipment: 'Dumbbells', videoUrl: demoSearchUrl('dumbbell lateral raise'), videoId: 'ssAo_xwFt5c', sets: 3, reps: '12-15' },
  { id: 'face-pull', name: 'Face Pull', category: 'shoulders', equipment: 'Cable/Band', videoUrl: demoSearchUrl('cable face pull'), videoId: 'eTCBSFlCJ_s', sets: 3, reps: '15-20' },

  { id: 'barbell-curl', name: 'Barbell Bicep Curl', category: 'arms', equipment: 'Barbell', videoUrl: demoSearchUrl('barbell bicep curl'), videoId: 'JJB8XgKltA8', sets: 3, reps: '10-12' },
  { id: 'tricep-pushdown', name: 'Tricep Pushdown', category: 'arms', equipment: 'Cable Machine', videoUrl: demoSearchUrl('tricep pushdown'), videoId: 'ozwo9RGm7QU', sets: 3, reps: '10-15' },
  { id: 'hammer-curl', name: 'Hammer Curl', category: 'arms', equipment: 'Dumbbells', videoUrl: demoSearchUrl('hammer curl'), videoId: 'zC3nLlEvin4', sets: 3, reps: '10-12' },

  { id: 'squat', name: 'Barbell Back Squat', category: 'legs', equipment: 'Barbell', videoUrl: demoSearchUrl('barbell back squat'), videoId: 'PGFvWqAQRm8', sets: 4, reps: '5-8' },
  { id: 'leg-press', name: 'Leg Press', category: 'legs', equipment: 'Machine', videoUrl: demoSearchUrl('leg press machine'), videoId: 'P-FZknD_DxM', sets: 3, reps: '10-15' },
  { id: 'lunge', name: 'Walking Lunge', category: 'legs', equipment: 'Dumbbells', videoUrl: demoSearchUrl('walking lunge'), videoId: 'BenhAbJiTsw', sets: 3, reps: '10-12/leg' },
  { id: 'leg-curl', name: 'Lying Leg Curl', category: 'legs', equipment: 'Machine', videoUrl: demoSearchUrl('lying leg curl machine'), videoId: 'lUH80pneL5w', sets: 3, reps: '10-12' },
  { id: 'calf-raise', name: 'Standing Calf Raise', category: 'legs', equipment: 'Machine', videoUrl: demoSearchUrl('standing calf raise'), videoId: 'ndQc4mz4mBU', sets: 4, reps: '12-15' },

  { id: 'hip-thrust', name: 'Barbell Hip Thrust', category: 'glutes', equipment: 'Barbell', videoUrl: demoSearchUrl('barbell hip thrust'), videoId: 'pBH7pKHn-dI', sets: 4, reps: '8-12' },
  { id: 'rdl', name: 'Romanian Deadlift', category: 'glutes', equipment: 'Barbell', videoUrl: demoSearchUrl('romanian deadlift'), videoId: 'lKLYvNGz6mk', sets: 3, reps: '8-10' },

  { id: 'plank', name: 'Plank', category: 'core', equipment: 'Bodyweight', videoUrl: demoSearchUrl('plank exercise'), videoId: 'mwlp75MS6Rg', sets: 3, reps: '30-60s' },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', category: 'core', equipment: 'Pull-up Bar', videoUrl: demoSearchUrl('hanging leg raise'), videoId: 'vwl68EF9M2Q', sets: 3, reps: '10-15' },
  { id: 'russian-twist', name: 'Russian Twist', category: 'core', equipment: 'Bodyweight/Plate', videoUrl: demoSearchUrl('russian twist'), videoId: 'fPxO-FA8acM', sets: 3, reps: '20 total' },

  { id: 'running', name: 'Steady-State Running', category: 'cardio', equipment: 'None', videoUrl: demoSearchUrl('running form technique'), videoId: 'btKgKarX5CY', notes: '20-30 min moderate pace' },
  { id: 'jump-rope', name: 'Jump Rope', category: 'cardio', equipment: 'Jump Rope', videoUrl: demoSearchUrl('jump rope technique'), videoId: '_UTR1VWg8WY', notes: '10-15 min intervals' },
  { id: 'burpee', name: 'Burpee', category: 'full_body', equipment: 'Bodyweight', videoUrl: demoSearchUrl('burpee'), videoId: 'G2hv_NYhM-A', sets: 3, reps: '10-15' },
  { id: 'kettlebell-swing', name: 'Kettlebell Swing', category: 'full_body', equipment: 'Kettlebell', videoUrl: demoSearchUrl('kettlebell swing'), videoId: '1Qi0NQW89Oc', sets: 3, reps: '15-20' },
];

export function findExercise(id: string): Exercise | undefined {
  return EXERCISE_LIBRARY.find((e) => e.id === id);
}
