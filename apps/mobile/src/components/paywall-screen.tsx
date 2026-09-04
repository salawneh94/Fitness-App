import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react-native';
import { Linking, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@fittrack/shared';
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
            {hasFreeTrial ? 'Try FitTrack free for 14 days' : 'Unlock FitTrack'}
          </Text>
          <Text className="text-sm mb-8" style={{ color: colors.textSecondary }}>
            Everything in FitTrack, in one subscription.
          </Text>

          <View className="gap-3 mb-8">
            {FEATURES.map((f) => (
              <View key={f} className="flex-row items-center gap-2.5">
                <CheckCircle2 size={18} color={colors.brandPrimary} />
                <Text className="text-sm flex-1" style={{ color: colors.textPrimary }}>
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
