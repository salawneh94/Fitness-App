import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '@fittrack/shared';
import { useAppStore } from '@/store/useAppStore';
import { useHydrated } from '@/store/useHydrated';
import OnboardingWizard from '@/components/onboarding-wizard';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const hydrated = useHydrated();
  const profile = useAppStore((s) => s.profile);

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync();
  }, [hydrated]);

  if (!hydrated) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.brandPrimary} />
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

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </>
  );
}
