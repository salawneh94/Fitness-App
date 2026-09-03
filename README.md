# FitTrack

A personal fitness & nutrition tracker. This repo is a pnpm workspace monorepo:

- `apps/web` — the original React + TypeScript + Vite web app (deployed to GitHub Pages).
- `apps/mobile` — the React Native (Expo) app for iOS and Android.
- `packages/shared` — the framework-agnostic business logic shared by both: calorie/macro planning, streak/adherence math, unit conversion, workout plan recommendation, the core data model, and exercise/plan-template data.

## Pages / screens

1. **Overview** — profile summary, today's calories left, workout time, weekly training minutes, weight change, macro progress, micronutrient breakdown.
2. **Nutrition** — log meals by category via manual entry or barcode scan (looked up against the free [Open Food Facts](https://world.openfoodfacts.org/) database).
3. **Workouts** — a Mon–Sun schedule grid, a guided workout player with rest timers and set logging, and exercise video demos.
4. **Plan Ideas** — a library of proven training splits that can be applied to the weekly schedule in one click.
5. **Progress** — streaks, adherence, weight/strength trends, body measurements, and before/after progress photos.

Daily calorie and macro targets are computed from the user's profile using the Mifflin-St Jeor equation, activity level, and goal, with safety-capped pacing toward any target weight/timeframe.

## Develop

This workspace uses **pnpm**.

```bash
pnpm install
pnpm web          # runs the web app (apps/web) in dev mode
```

## Build (web)

```bash
pnpm web:build
```

## Mobile app

`apps/mobile` is under active development — see the project plan for the milestone roadmap (repo restructure → app shell → core screens → accounts/sync → subscriptions → store submission).
