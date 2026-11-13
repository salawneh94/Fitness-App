# Browser tests

These drive the real app — its web export, in Chromium — against an in-memory stand-in for
Supabase. They cover what the unit tests in `packages/shared` can't reach: the store, the sync
queue, and the screens.

```sh
pnpm --filter mobile e2e                      # build, serve, run everything
pnpm --filter mobile e2e sync auth            # only these suites
E2E_SKIP_BUILD=1 pnpm --filter mobile e2e     # reuse the last build
```

Screenshots land in `e2e/.screenshots/`.

- `lib/harness.mjs` — the fake backend and `openApp()`. The backend is faithful where it has
  mattered: rows are keyed by the same unique constraints as the migrations, responses are capped
  at 1,000 rows like hosted Supabase, writes to another user's rows are refused as row-level
  security would, and "offline" fails requests instead of returning nothing.
- `suites/*.mjs` — one file per area; each default-exports `async ({ check, errors, shot })`.

The build sets `EXPO_PUBLIC_E2E=1`, which lets the suite past the paywall. That flag is honoured
on web only (see `src/store/useEntitlementStore.ts`); an iOS or Android build ignores it.

When you fix a bug, add the check that would have caught it here first and watch it fail.
