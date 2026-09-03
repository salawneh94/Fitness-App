# FitTrack mobile

The native iOS/Android app, built with Expo (managed workflow) + Expo Router + NativeWind. Shares its core business logic and data model with the web app (`apps/web`) via `packages/shared`.

## Develop

From the repo root:

```bash
pnpm install
pnpm --filter mobile start
```

Then open in Expo Go (scan the QR code) or a simulator. Some native modules (camera/barcode scanning, coming in a later milestone) require a custom dev client instead of Expo Go — see the project plan for the milestone roadmap.
