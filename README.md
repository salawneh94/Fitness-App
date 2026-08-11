# FitTrack

A personal fitness & nutrition tracker built with React, TypeScript, Vite, and Tailwind CSS. Data is stored locally in the browser (no backend required).

## Pages

1. **Overview** — profile summary (name, age, height, weight, goal, expectations), today's calories left, workout time, weekly training minutes, weight change, macro progress, micronutrient breakdown, and a weight trend chart.
2. **Nutrition** — log meals by category (breakfast/lunch/dinner/snacks) via manual entry or by scanning a product barcode (looked up against the free [Open Food Facts](https://world.openfoodfacts.org/) database) for automatic calorie, macro, and micronutrient info.
3. **Workouts** — a Mon–Sun schedule grid; each day lists its exercises with a form-demo link, and workouts can be logged with duration/calories/notes to build a history.
4. **Plan Ideas** — a library of proven training splits (Upper/Lower, Push/Pull/Legs, Full Body, Bro Split, Home Bodyweight, Cardio & Conditioning) that can be applied to the weekly schedule in one click.

Daily calorie and macro targets are computed from the user's profile using the Mifflin-St Jeor equation, activity level, and goal.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
