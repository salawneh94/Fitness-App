import { useMemo, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react-native';
import { Linking, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, planDailyTargets } from '@fittrack/shared';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useEntitlementStore } from '@/store/useEntitlementStore';
import PressableScale from '@/components/ui/pressable-scale';

// Apple's standard EULA — used as-is since this app doesn't have custom subscription terms
// beyond what StoreKit/Play Billing already enforce.
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
// Hosted on the existing GitHub Pages deploy of apps/web (see PrivacyPolicyPage.tsx) — verify
// this resolves once Pages is confirmed live for this repo.
const PRIVACY_URL = 'https://salawneh94.github.io/Fitness-App/#/privacy';

const FEATURES = [
  'Unlimited nutrition & barcode scanning',
  'Guided workouts with video demos',
  'Full progress history, synced across devices',
  'Progress photos with before/after comparison',
];

export default function PaywallScreen() {
  const offering = useEntitlementStore((s) => s.offering);
  const purchase = useEntitlementStore((s) => s.purchase);
  const restore = useEntitlementStore((s) => s.restore);
  const signOut = useAuthStore((s) => s.signOut);

  // This screen only ever renders after onboarding (see the gate order in _layout), so the
  // profile and the seeded plan are already there. Selling four generic bullets at the exact
  // moment the app can show someone their own numbers is a wasted screen.
  const profile = useAppStore((s) => s.profile);
  const scheduledWorkouts = useAppStore((s) => s.scheduledWorkouts);
  const targets = useMemo(() => (profile ? planDailyTargets(profile) : null), [profile]);
  const trainingDays = scheduledWorkouts.length;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pkg = offering?.availablePackages[0] ?? null;
  const product = pkg?.product ?? null;
  const hasFreeTrial = !!product?.introPrice && product.introPrice.price === 0;

  async function handlePurchase() {
    if (!pkg || busy) return;
    setBusy(true);
    setError(null);
    const { error } = await purchase(pkg);
    if (error) setError(error);
    setBusy(false);
  }

  async function handleRestore() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error } = await restore();
    if (error) setError(error);
    setBusy(false);
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingVertical: 24, flexGrow: 1 }}>
        <View className="flex-1 justify-center">
          <Text className="text-2xl font-bold mb-2" style={{ color: colors.textPrimary }}>
            {profile ? `Your plan is ready, ${profile.name.split(' ')[0]}` : 'Unlock FitTrack'}
          </Text>
          <Text className="text-sm mb-6" style={{ color: colors.textSecondary }}>
            {hasFreeTrial
              ? 'Start your 14-day free trial to begin tracking against it.'
              : 'Subscribe to begin tracking against it.'}
          </Text>

          {/* The user's own numbers, worked out from what they just told us. Someone who has
              answered eight questions has earned a look at the answer — and a target with their
              name on it argues for the subscription better than a feature list can. */}
          {targets && (
            <View
              className="rounded-2xl p-4 mb-4 border"
              style={{ backgroundColor: colors.chartSurface, borderColor: colors.gridline }}
            >
              <Text className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: colors.textMuted }}>
                Your daily targets
              </Text>
              <View className="flex-row justify-between">
                {[
                  { value: targets.calories.toLocaleString(), label: 'kcal' },
                  { value: `${targets.proteinG}g`, label: 'protein' },
                  { value: `${targets.carbsG}g`, label: 'carbs' },
                  { value: `${targets.fatG}g`, label: 'fat' },
                ].map((s) => (
                  <View key={s.label} className="items-center">
                    <Text
                      className="text-lg font-bold"
                      style={{ color: colors.textPrimary, fontVariant: ['tabular-nums'] }}
                    >
                      {s.value}
                    </Text>
                    <Text className="text-xs" style={{ color: colors.textMuted }}>
                      {s.label}
                    </Text>
                  </View>
                ))}
              </View>
              {trainingDays > 0 && (
                <Text className="text-xs mt-3 pt-3 border-t" style={{ color: colors.textSecondary, borderColor: colors.gridline }}>
                  Plus a {trainingDays}-day training week already scheduled for you, with video demos
                  for every exercise.
                </Text>
              )}
            </View>
          )}

          <View className="gap-2.5 mb-6">
            {FEATURES.map((f) => (
              <View key={f} className="flex-row items-center gap-2.5">
                <CheckCircle2 size={16} color={colors.brandPrimary} />
                <Text className="text-sm flex-1" style={{ color: colors.textSecondary }}>
                  {f}
                </Text>
              </View>
            ))}
          </View>

          {product ? (
            <View
              className="rounded-2xl p-4 mb-4 border items-center"
              style={{ backgroundColor: colors.chartSurface, borderColor: colors.brandPrimary }}
            >
              <Text className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                {hasFreeTrial
                  ? `${product.introPrice!.periodNumberOfUnits} ${product.introPrice!.periodUnit.toLowerCase()} free, then ${product.priceString}`
                  : product.priceString}
              </Text>
              <Text className="text-xs mt-1" style={{ color: colors.textMuted }}>
                Auto-renews. Cancel anytime in your {Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'} account settings.
              </Text>
            </View>
          ) : (
            <View className="rounded-2xl p-4 mb-4 border items-center" style={{ backgroundColor: colors.chartSurface, borderColor: colors.gridline }}>
              <Text className="text-sm text-center" style={{ color: colors.textMuted }}>
                Subscription options aren't available right now. Check your connection and try again shortly.
              </Text>
            </View>
          )}

          {error && (
            <Text className="text-sm mb-4 text-center" style={{ color: colors.statusCritical }}>
              {error}
            </Text>
          )}

          <PressableScale hapticStyle="success"
            onPress={handlePurchase}
            disabled={!pkg || busy}
            className="items-center py-3.5 rounded-full mb-3 flex-row justify-center gap-2"
            style={{ backgroundColor: colors.brandPrimaryDark, opacity: !pkg || busy ? 0.4 : 1 }}
          >
            {busy && <Loader2 size={16} color="white" />}
            <Text className="text-white text-sm font-semibold">
              {hasFreeTrial ? 'Start Free Trial' : 'Subscribe'}
            </Text>
          </PressableScale>

          <PressableScale onPress={handleRestore} disabled={busy} className="items-center py-2.5">
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              Restore Purchases
            </Text>
          </PressableScale>

          <View className="flex-row justify-center gap-4 mt-2">
            <PressableScale onPress={() => Linking.openURL(TERMS_URL)}>
              <Text className="text-xs underline" style={{ color: colors.textMuted }}>
                Terms of Use
              </Text>
            </PressableScale>
            <PressableScale onPress={() => Linking.openURL(PRIVACY_URL)}>
              <Text className="text-xs underline" style={{ color: colors.textMuted }}>
                Privacy Policy
              </Text>
            </PressableScale>
          </View>

          <PressableScale onPress={() => signOut()} className="items-center py-4 mt-2">
            <Text className="text-xs" style={{ color: colors.textMuted }}>
              Sign out
            </Text>
          </PressableScale>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
