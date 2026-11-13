# FitTrack mobile

The native iOS/Android app, built with Expo (managed workflow) + Expo Router + NativeWind. Shares its core business logic and data model with the web app (`apps/web`) via `packages/shared`.

## Develop

From the repo root:

```bash
pnpm install
pnpm --filter mobile start
```

Then open in Expo Go (scan the QR code) or a simulator. Some native modules (camera/barcode scanning, coming in a later milestone) require a custom dev client instead of Expo Go — see the project plan for the milestone roadmap.

## Backend setup (Supabase)

1. Create a project, copy its URL and anon key into `apps/mobile/.env` (see `.env.example`).
2. Run every file in `supabase/migrations/` in order (`0001` … `0005`).
3. **Password reset email.** The app resets passwords with a code typed into the app, not a link.
   In the dashboard under Authentication → Email Templates → *Reset Password*, make sure the
   body includes the code:

   ```html
   <p>Your FitTrack reset code is <strong>{{ .Token }}</strong></p>
   ```

   The default template only contains a link (`{{ .ConfirmationURL }}`), which this app has no
   way to open — with it left as is, "Forgot password?" sends an email nobody can use.
4. **Email sending.** Supabase's built-in mail service is for testing and allows only a handful
   of emails an hour. Before real users, set a custom SMTP provider under Authentication →
   Settings, or sign-up confirmations and reset codes will silently stop arriving.

## Tests

```bash
pnpm test                    # unit tests (packages/shared)
pnpm --filter mobile e2e     # browser tests against a fake Supabase — see e2e/README.md
```
