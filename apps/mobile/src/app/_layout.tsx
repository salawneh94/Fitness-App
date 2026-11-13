import '../global.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import { colors } from '@fittrack/shared';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useEntitlementStore } from '@/store/useEntitlementStore';
import { useHydrated } from '@/store/useHydrated';
import { pullRemote } from '@/lib/sync';
import { useSyncQueue } from '@/lib/sync-queue';
import { initCrashReporting } from '@/lib/crash-reporting';
import { useReminderStore } from '@/store/useReminderStore';
import OnboardingWizard from '@/components/onboarding-wizard';
import AuthScreen from '@/components/auth-screen';
import PaywallScreen from '@/components/paywall-screen';
import PressableScale from '@/components/ui/pressable-scale';

/** How long the first download of an account may take before it's called a failure. */
const FIRST_SYNC_TIMEOUT_MS = 20_000;

SplashScreen.preventAutoHideAsync();

// Before anything else renders, so a crash during the first paint is still captured.
initCrashReporting();

// Expo Router mounts this around everything below the root route, so any render that throws
// lands on a recoverable screen instead of a blank one.
export { default as ErrorBoundary } from '@/components/crash-screen';

export default function RootLayout() {
  const storeHydrated = useHydrated();
  const authHydrated = useAuthStore((s) => s.hydrated);
  const entitlementHydrated = useEntitlementStore((s) => s.hydrated);
  const entitlementActive = useEntitlementStore((s) => s.active);
  const session = useAuthStore((s) => s.session);
  const profile = useAppStore((s) => s.profile);

  useEffect(() => {
    useAuthStore.getState().init();
    void useEntitlementStore.getState().init();
  }, []);

  const ready = storeHydrated && authHydrated && entitlementHydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // What stands between signing in and seeing the app: making this device's data this account's,
  // and — when there's none here yet — the first download of it.
  //
  // "No profile on the device" used to mean "new user", so a returning user on a new phone was
  // shown onboarding while their real profile was still on its way, and if the download failed
  // they could complete it — which then overwrote the real profile on the server. Only a pull the
  // server actually answered can say there is no profile.
  const userId = session?.user.id ?? null;
  const [boot, setBoot] = useState<{ userId: string; status: 'loading' | 'ready' | 'failed' } | null>(null);
  const startAccount = useCallback(async (id: string) => {
    // If someone else's data is on this device, it goes before anything is rendered from it.
    useAppStore.getState().adoptOwner(id);
    // A profile already here means this person has used this device: open straight away (this is
    // what keeps a cold start with no connection working) and reconcile in the background.
    const hadProfile = Boolean(useAppStore.getState().profile);
    setBoot({ userId: id, status: hadProfile ? 'ready' : 'loading' });
    // Send before fetching, so writes made here earlier (perhaps before a sign-out) are part of
    // what comes back, rather than racing it.
    await useSyncQueue.getState().flush();
    // Full reconcile on sign-in/cold start: the only pass that can notice rows deleted on
    // another device. Bounded, so a connection that accepts requests and never answers ends in
    // "couldn't load" with a retry, not a spinner forever.
    const { profileKnown } = await Promise.race([
      pullRemote(id, { full: true }),
      new Promise<{ profileKnown: boolean }>((resolve) => setTimeout(() => resolve({ profileKnown: false }), FIRST_SYNC_TIMEOUT_MS)),
    ]);
    setBoot((current) => (current?.userId === id ? { userId: id, status: hadProfile || profileKnown ? 'ready' : 'failed' } : current));
  }, []);

  // Start whenever we transition into a signed-in state, and pull again every time the app
  // returns to the foreground while signed in — this is how a second device (or a reinstall)
  // catches up on data written elsewhere.
  const startedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (!userId) {
      startedFor.current = null;
      setBoot(null);
      return;
    }
    if (startedFor.current !== userId) {
      startedFor.current = userId;
      void startAccount(userId);
      // Ties RevenueCat's identity to the Supabase user id, so the webhook can join purchase
      // events back to the right account regardless of which device made the purchase.
      void useEntitlementStore.getState().logInAndRefresh(userId);
    }
    // Whether tonight's reminder is still warranted depends on what has been logged, so it is
    // re-evaluated on the same signals as sync rather than left on a fixed schedule.
    void useReminderStore.getState().refresh();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // Foregrounding pulls only what changed since the last watermark, so coming back to the
        // app costs one small delta instead of re-downloading the whole history.
        void pullRemote(userId);
        void useSyncQueue.getState().flush();
        void useReminderStore.getState().refresh();
      }
    });
    return () => subscription.remove();
  }, [ready, userId, startAccount]);

  if (!ready) {
    return (
      // A bare spinner on a black field is indistinguishable from a hung app. Showing the
      // wordmark makes the wait feel like the app starting rather than nothing happening.
      <View className="flex-1 items-center justify-center gap-5" style={{ backgroundColor: colors.background }}>
        <Text className="text-3xl font-bold" style={{ color: colors.textPrimary, letterSpacing: -0.8 }}>
          Fit<Text style={{ color: colors.brandPrimary }}>Track</Text>
        </Text>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  if (!session) {
    return (
      <>
        <StatusBar style="light" />
        <AuthScreen />
      </>
    );
  }

  // Not this account's turn yet: either the effect above hasn't run for this session, or the first
  // download is still in flight. Nothing from the store is rendered until it has.
  if (!boot || boot.userId !== userId || boot.status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center gap-4" style={{ backgroundColor: colors.background }}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.brandPrimary} />
        <Text className="text-sm" style={{ color: colors.textSecondary }}>
          Loading your data…
        </Text>
      </View>
    );
  }

  if (boot.status === 'failed' && !profile) {
    return (
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: colors.background }}>
        <StatusBar style="light" />
        <Text className="text-xl font-bold text-center mb-2" style={{ color: colors.textPrimary }}>
          Couldn’t load your account
        </Text>
        <Text className="text-sm text-center mb-8" style={{ color: colors.textSecondary }}>
          Your data is safe — we just couldn’t reach it. Check your connection and try again.
        </Text>
        <PressableScale
          accessibilityRole="button"
          onPress={() => void startAccount(boot.userId)}
          className="px-6 py-3 rounded-full mb-3"
          style={{ backgroundColor: colors.brandPrimaryDark }}
        >
          <Text className="text-white text-sm font-semibold">Try again</Text>
        </PressableScale>
        <PressableScale accessibilityRole="button" onPress={() => void useAuthStore.getState().signOut()} className="px-6 py-3">
          <Text className="text-sm" style={{ color: colors.textMuted }}>
            Sign out
          </Text>
        </PressableScale>
      </View>
    );
  }

  if (!profile) {
    return (
      <>
        <StatusBar style="light" />
        <OnboardingWizard />
      </>
    );
  }

  // Everything past onboarding sits behind one entitlement — no separate free tier (see the
  // approved plan's paywall decision).
  if (!entitlementActive) {
    return (
      <>
        <StatusBar style="light" />
        <PaywallScreen />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </>
  );
}
