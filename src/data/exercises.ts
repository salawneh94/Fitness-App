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
  // Chest
  { id: 'bench-press', name: 'Barbell Bench Press', category: 'chest', equipment: 'Barbell', videoUrl: demoSearchUrl('barbell bench press'), videoId: 'Pp8rHcFVIYg', sets: 4, reps: '6-10' },
  { id: 'incline-db-press', name: 'Incline Dumbbell Press', category: 'chest', equipment: 'Dumbbells', videoUrl: demoSearchUrl('incline dumbbell press'), videoId: 'awEEyL5zGvU', sets: 3, reps: '8-12' },
  { id: 'push-up', name: 'Push-Up', category: 'chest', equipment: 'Bodyweight', videoUrl: demoSearchUrl('push up'), videoId: 'WDIpL0pjun0', sets: 3, reps: '12-20' },
  { id: 'dips', name: 'Chest Dips', category: 'chest', equipment: 'Dip Bars', videoUrl: demoSearchUrl('chest dips'), videoId: 'yN6Q1UI_xkE', sets: 3, reps: '8-12' },
  { id: 'cable-fly', name: 'Cable Fly', category: 'chest', equipment: 'Cable Machine', videoUrl: demoSearchUrl('cable fly'), videoId: 'XNf6TBErGys', sets: 3, reps: '12-15' },
  { id: 'decline-bench-press', name: 'Decline Barbell Bench Press', category: 'chest', equipment: 'Barbell', videoUrl: demoSearchUrl('decline barbell bench press'), videoId: 'FFyGwcLnDYc', sets: 4, reps: '6-10' },
  { id: 'decline-db-press', name: 'Decline Dumbbell Press', category: 'chest', equipment: 'Dumbbells', videoUrl: demoSearchUrl('decline dumbbell press'), videoId: 'gIUGhuW-AbA', sets: 3, reps: '8-12' },
  { id: 'pec-deck-fly', name: 'Pec Deck Machine Fly', category: 'chest', equipment: 'Machine', videoUrl: demoSearchUrl('pec deck machine fly'), videoId: 'JYmszQs-mRs', sets: 3, reps: '12-15' },

  // Back
  { id: 'deadlift', name: 'Conventional Deadlift', category: 'back', equipment: 'Barbell', videoUrl: demoSearchUrl('conventional deadlift'), videoId: 'GxsLrTzyGUU', sets: 3, reps: '4-6' },
  { id: 'pull-up', name: 'Pull-Up', category: 'back', equipment: 'Pull-up Bar', videoUrl: demoSearchUrl('pull up'), videoId: 'nfCHD8i8UI4', sets: 4, reps: '6-12' },
  { id: 'barbell-row', name: 'Barbell Row', category: 'back', equipment: 'Barbell', videoUrl: demoSearchUrl('barbell row'), videoId: 'gScFsUWwFmc', sets: 4, reps: '8-10' },
  { id: 'lat-pulldown', name: 'Lat Pulldown', category: 'back', equipment: 'Cable Machine', videoUrl: demoSearchUrl('lat pulldown'), videoId: 'SALxEARiMkw', sets: 3, reps: '10-12' },
  { id: 't-bar-row', name: 'T-Bar Row', category: 'back', equipment: 'Barbell/T-Bar Machine', videoUrl: demoSearchUrl('t-bar row'), videoId: 'BbBR3v2UShw', sets: 4, reps: '8-10' },
  { id: 'single-arm-db-row', name: 'Single-Arm Dumbbell Row', category: 'back', equipment: 'Dumbbells', videoUrl: demoSearchUrl('single arm dumbbell row'), videoId: 'dgsvDdAOHIY', sets: 3, reps: '10-12/side' },
  { id: 'chest-supported-row', name: 'Chest-Supported Row', category: 'back', equipment: 'Dumbbells/Machine', videoUrl: demoSearchUrl('chest supported row'), videoId: 'XLoIFFXjFyY', sets: 3, reps: '10-12' },
  { id: 'rack-pull', name: 'Rack Pull', category: 'back', equipment: 'Barbell', videoUrl: demoSearchUrl('rack pull'), videoId: 'DizJXKoHBJw', sets: 3, reps: '5-8' },

  // Shoulders
  { id: 'ohp', name: 'Overhead Press', category: 'shoulders', equipment: 'Barbell', videoUrl: demoSearchUrl('barbell overhead press'), videoId: 'a81SaIpjGlA', sets: 4, reps: '6-10' },
  { id: 'lateral-raise', name: 'Dumbbell Lateral Raise', category: 'shoulders', equipment: 'Dumbbells', videoUrl: demoSearchUrl('dumbbell lateral raise'), videoId: 'ssAo_xwFt5c', sets: 3, reps: '12-15' },
  { id: 'face-pull', name: 'Face Pull', category: 'shoulders', equipment: 'Cable/Band', videoUrl: demoSearchUrl('cable face pull'), videoId: 'eTCBSFlCJ_s', sets: 3, reps: '15-20' },
  { id: 'arnold-press', name: 'Arnold Press', category: 'shoulders', equipment: 'Dumbbells', videoUrl: demoSearchUrl('arnold press'), videoId: '6Z15_WdXmVw', sets: 3, reps: '8-12' },
  { id: 'front-raise', name: 'Dumbbell Front Raise', category: 'shoulders', equipment: 'Dumbbells', videoUrl: demoSearchUrl('dumbbell front raise'), videoId: 'CH9JzDStL3U', sets: 3, reps: '12-15' },
  { id: 'shrugs', name: 'Barbell Shrug', category: 'shoulders', equipment: 'Barbell', videoUrl: demoSearchUrl('barbell shrug'), videoId: 'KbsQ1E8Hg0o', sets: 4, reps: '10-15' },

  // Arms
  { id: 'barbell-curl', name: 'Barbell Bicep Curl', category: 'arms', equipment: 'Barbell', videoUrl: demoSearchUrl('barbell bicep curl'), videoId: 'JJB8XgKltA8', sets: 3, reps: '10-12' },
  { id: 'tricep-pushdown', name: 'Tricep Pushdown', category: 'arms', equipment: 'Cable Machine', videoUrl: demoSearchUrl('tricep pushdown'), videoId: 'ozwo9RGm7QU', sets: 3, reps: '10-15' },
  { id: 'hammer-curl', name: 'Hammer Curl', category: 'arms', equipment: 'Dumbbells', videoUrl: demoSearchUrl('hammer curl'), videoId: 'zC3nLlEvin4', sets: 3, reps: '10-12' },
  { id: 'skull-crusher', name: 'Skull Crusher', category: 'arms', equipment: 'Barbell/EZ-Bar', videoUrl: demoSearchUrl('skull crusher lying tricep extension'), videoId: 'tj81tVq3wLo', sets: 3, reps: '10-12' },
  { id: 'preacher-curl', name: 'Preacher Curl', category: 'arms', equipment: 'Barbell/EZ-Bar', videoUrl: demoSearchUrl('preacher curl'), videoId: 'BPmUhDtdQfw', sets: 3, reps: '10-12' },
  { id: 'close-grip-bench-press', name: 'Close-Grip Bench Press', category: 'arms', equipment: 'Barbell', videoUrl: demoSearchUrl('close grip bench press'), videoId: 'a2G3IdaTcPU', sets: 4, reps: '6-10' },

  // Legs
  { id: 'squat', name: 'Barbell Back Squat', category: 'legs', equipment: 'Barbell', videoUrl: demoSearchUrl('barbell back squat'), videoId: 'PGFvWqAQRm8', sets: 4, reps: '5-8' },
  { id: 'leg-press', name: 'Leg Press', category: 'legs', equipment: 'Machine', videoUrl: demoSearchUrl('leg press machine'), videoId: 'P-FZknD_DxM', sets: 3, reps: '10-15' },
  { id: 'lunge', name: 'Walking Lunge', category: 'legs', equipment: 'Dumbbells', videoUrl: demoSearchUrl('walking lunge'), videoId: 'BenhAbJiTsw', sets: 3, reps: '10-12/leg' },
  { id: 'leg-curl', name: 'Lying Leg Curl', category: 'legs', equipment: 'Machine', videoUrl: demoSearchUrl('lying leg curl machine'), videoId: 'lUH80pneL5w', sets: 3, reps: '10-12' },
  { id: 'calf-raise', name: 'Standing Calf Raise', category: 'legs', equipment: 'Machine', videoUrl: demoSearchUrl('standing calf raise'), videoId: 'ndQc4mz4mBU', sets: 4, reps: '12-15' },
  { id: 'front-squat', name: 'Front Squat', category: 'legs', equipment: 'Barbell', videoUrl: demoSearchUrl('front squat'), videoId: 'wyDbagKS7Rg', sets: 4, reps: '5-8' },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', category: 'legs', equipment: 'Dumbbells', videoUrl: demoSearchUrl('bulgarian split squat'), videoId: 'VPhhE6bBzZE', sets: 3, reps: '8-12/leg' },
  { id: 'goblet-squat', name: 'Goblet Squat', category: 'legs', equipment: 'Kettlebell/Dumbbell', videoUrl: demoSearchUrl('goblet squat'), videoId: 'JO7D6GJ98wY', sets: 3, reps: '12-15' },
  { id: 'step-up', name: 'Dumbbell Step-Up', category: 'legs', equipment: 'Dumbbells', videoUrl: demoSearchUrl('dumbbell step up'), videoId: 'aKj-6hgiViA', sets: 3, reps: '10-12/leg' },
  { id: 'leg-extension', name: 'Leg Extension', category: 'legs', equipment: 'Machine', videoUrl: demoSearchUrl('leg extension machine'), videoId: 'MXvSzXEBOTI', sets: 3, reps: '12-15' },

  // Glutes
  { id: 'hip-thrust', name: 'Barbell Hip Thrust', category: 'glutes', equipment: 'Barbell', videoUrl: demoSearchUrl('barbell hip thrust'), videoId: 'pBH7pKHn-dI', sets: 4, reps: '8-12' },
  { id: 'rdl', name: 'Romanian Deadlift', category: 'glutes', equipment: 'Barbell', videoUrl: demoSearchUrl('romanian deadlift'), videoId: 'lKLYvNGz6mk', sets: 3, reps: '8-10' },
  { id: 'cable-kickback', name: 'Cable Glute Kickback', category: 'glutes', equipment: 'Cable Machine', videoUrl: demoSearchUrl('cable glute kickback'), videoId: 'bVrmtCI00Ys', sets: 3, reps: '12-15/side' },
  { id: 'glute-bridge', name: 'Glute Bridge', category: 'glutes', equipment: 'Bodyweight/Barbell', videoUrl: demoSearchUrl('glute bridge'), videoId: 'wPM8icPu6H8', sets: 3, reps: '15-20' },
  { id: 'sumo-deadlift', name: 'Sumo Deadlift', category: 'glutes', equipment: 'Barbell', videoUrl: demoSearchUrl('sumo deadlift'), videoId: 'ab1sUJErTzc', sets: 3, reps: '5-8' },

  // Core
  { id: 'plank', name: 'Plank', category: 'core', equipment: 'Bodyweight', videoUrl: demoSearchUrl('plank exercise'), videoId: 'mwlp75MS6Rg', sets: 3, reps: '30-60s' },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', category: 'core', equipment: 'Pull-up Bar', videoUrl: demoSearchUrl('hanging leg raise'), videoId: 'vwl68EF9M2Q', sets: 3, reps: '10-15' },
  { id: 'russian-twist', name: 'Russian Twist', category: 'core', equipment: 'Bodyweight/Plate', videoUrl: demoSearchUrl('russian twist'), videoId: 'fPxO-FA8acM', sets: 3, reps: '20 total' },
  { id: 'cable-crunch', name: 'Cable Crunch', category: 'core', equipment: 'Cable Machine', videoUrl: demoSearchUrl('cable crunch'), videoId: '809A_MuZ2PY', sets: 3, reps: '15-20' },
  { id: 'bicycle-crunch', name: 'Bicycle Crunch', category: 'core', equipment: 'Bodyweight', videoUrl: demoSearchUrl('bicycle crunch'), videoId: 'wpRI3xBhJmo', sets: 3, reps: '20 total' },
  { id: 'dead-bug', name: 'Dead Bug', category: 'core', equipment: 'Bodyweight', videoUrl: demoSearchUrl('dead bug exercise'), videoId: 'bxn9FBrt4-A', sets: 3, reps: '10/side' },
  { id: 'ab-wheel-rollout', name: 'Ab Wheel Rollout', category: 'core', equipment: 'Ab Wheel', videoUrl: demoSearchUrl('ab wheel rollout'), videoId: 'NbudTqiwguk', sets: 3, reps: '8-12' },

  // Cardio
  { id: 'running', name: 'Steady-State Running', category: 'cardio', equipment: 'None', videoUrl: demoSearchUrl('running form technique'), videoId: 'btKgKarX5CY', notes: '20-30 min moderate pace' },
  { id: 'jump-rope', name: 'Jump Rope', category: 'cardio', equipment: 'Jump Rope', videoUrl: demoSearchUrl('jump rope technique'), videoId: '_UTR1VWg8WY', notes: '10-15 min intervals' },
  { id: 'rowing-machine', name: 'Rowing Machine', category: 'cardio', equipment: 'Rowing Machine', videoUrl: demoSearchUrl('rowing machine proper technique'), videoId: '4zWu1yuJ0_g', notes: '15-20 min steady pace' },
  { id: 'cycling', name: 'Stationary Bike', category: 'cardio', equipment: 'Stationary Bike', videoUrl: demoSearchUrl('stationary bike cycling proper form'), videoId: 'jSEsIZ9ucgM', notes: '20-30 min moderate pace' },

  // Full Body
  { id: 'burpee', name: 'Burpee', category: 'full_body', equipment: 'Bodyweight', videoUrl: demoSearchUrl('burpee'), videoId: 'G2hv_NYhM-A', sets: 3, reps: '10-15' },
  { id: 'kettlebell-swing', name: 'Kettlebell Swing', category: 'full_body', equipment: 'Kettlebell', videoUrl: demoSearchUrl('kettlebell swing'), videoId: '1Qi0NQW89Oc', sets: 3, reps: '15-20' },
  { id: 'mountain-climber', name: 'Mountain Climber', category: 'full_body', equipment: 'Bodyweight', videoUrl: demoSearchUrl('mountain climber exercise'), videoId: 'ZhiCSdOVJp0', sets: 3, reps: '20-30s' },
  { id: 'thruster', name: 'Dumbbell Thruster', category: 'full_body', equipment: 'Dumbbells', videoUrl: demoSearchUrl('dumbbell thruster'), videoId: 'He4-ttcwthg', sets: 3, reps: '10-12' },
];

export function findExercise(id: string): Exercise | undefined {
  return EXERCISE_LIBRARY.find((e) => e.id === id);
}
