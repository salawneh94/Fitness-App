import '../global.css';
import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, AppState, View } from 'react-native';
import { colors } from '@fittrack/shared';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useEntitlementStore } from '@/store/useEntitlementStore';
import { useHydrated } from '@/store/useHydrated';
import { pullRemote } from '@/lib/sync';
import { useSyncQueue } from '@/lib/sync-queue';
import OnboardingWizard from '@/components/onboarding-wizard';
import AuthScreen from '@/components/auth-screen';
import PaywallScreen from '@/components/paywall-screen';

SplashScreen.preventAutoHideAsync();

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

  // Pull remote data down whenever we transition into a signed-in state, and again every time
  // the app returns to the foreground while signed in — this is how a second device (or a
  // reinstall) catches up on data written elsewhere.
  const userId = session?.user.id ?? null;
  const lastPulledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !userId) return;
    if (lastPulledFor.current !== userId) {
      lastPulledFor.current = userId;
      void pullRemote(userId);
      // Ties RevenueCat's identity to the Supabase user id, so the webhook can join purchase
      // events back to the right account regardless of which device made the purchase.
      void useEntitlementStore.getState().logInAndRefresh(userId);
    }
    void useSyncQueue.getState().flush();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void pullRemote(userId);
        void useSyncQueue.getState().flush();
      }
    });
    return () => subscription.remove();
  }, [ready, userId]);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
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
