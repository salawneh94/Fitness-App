import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

// The one entitlement this app gates on — must match the identifier configured in the
// RevenueCat dashboard (Entitlements). Everything is behind this single trial-then-subscription
// gate; there's no separate free tier (see the approved plan's paywall decision).
export const ENTITLEMENT_ID = 'pro';

const apiKey =
  Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
    : Platform.OS === 'android'
      ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
      : undefined;

let configured = false;

/** Configures the RevenueCat SDK once. A no-op (with a console warning) until the platform API
 * key env var is set, and on any platform other than iOS/Android — there's no app store to
 * transact against on web. */
export function configureRevenueCat() {
  if (configured) return;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  if (!apiKey) {
    console.warn(
      'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY are not set — ' +
        'subscriptions will not work until apps/mobile/.env is filled in (see .env.example).'
    );
    return;
  }
  Purchases.configure({ apiKey });
  configured = true;
}

export function isRevenueCatConfigured(): boolean {
  return configured;
}
