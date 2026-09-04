import { useState } from 'react';
import { LogOut, Trash2 } from 'lucide-react-native';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useSyncQueue } from '@/lib/sync-queue';
import { supabase } from '@/lib/supabase';
import type { ActivityLevel, Goal, Profile, Sex, UnitSystem } from '@fittrack/shared';
import { ACTIVITY_LABELS, GOAL_LABELS, bmi, planDailyTargets, colors } from '@fittrack/shared';
import Card from './ui/card';
import TargetPlanNote from './target-plan-note';
import WeightInput from './ui/weight-input';
import HeightInput from './ui/height-input';
import UnitToggle from './ui/unit-toggle';
import TextField from './ui/text-field';
import SelectField from './ui/select-field';
import PressableScale from '@/components/ui/pressable-scale';

const GOALS: Goal[] = ['lose_fat', 'build_muscle', 'maintain', 'improve_endurance', 'general_health'];
const ACTIVITIES: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const SEXES: Sex[] = ['male', 'female', 'other'];
const SEX_LABELS: Record<Sex, string> = { male: 'Male', female: 'Female', other: 'Other' };

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-sm font-medium mb-1.5" style={{ color: colors.textSecondary }}>
      {children}
    </Text>
  );
}

export default function EditProfileForm() {
  const existing = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const authEmail = useAuthStore((s) => s.session?.user.email);
  const signOut = useAuthStore((s) => s.signOut);
  const resetLocalData = useAppStore((s) => s.resetLocalData);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) {
        Alert.alert('Could not delete account', error.message ?? 'Please try again.');
        return;
      }
      useSyncQueue.getState().clear();
      resetLocalData();
      await signOut();
    } catch {
      Alert.alert('Could not delete account', 'Check your connection and try again.');
    } finally {
      setDeleting(false);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This permanently deletes your account and all your data — profile, logs, workouts, and photos. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Account', style: 'destructive', onPress: handleDeleteAccount },
      ]
    );
  }

  const [form, setForm] = useState({
    name: existing?.name ?? '',
    age: existing?.age ?? 28,
    sex: (existing?.sex ?? 'male') as Sex,
    heightCm: existing?.heightCm ?? 175,
    weightKg: existing?.weightKg ?? 75,
    goal: (existing?.goal ?? 'build_muscle') as Goal,
    targetWeightKg: existing?.targetWeightKg ?? 75,
    timeframeWeeks: existing?.timeframeWeeks ?? 12,
    expectations: existing?.expectations ?? '',
    activityLevel: (existing?.activityLevel ?? 'moderate') as ActivityLevel,
    preferredDaysPerWeek: existing?.preferredDaysPerWeek ?? 4,
    unitSystem: (existing?.unitSystem ?? 'metric') as UnitSystem,
  });

  function submit() {
    if (!form.name.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    const profile: Profile = {
      ...form,
      age: Number(form.age),
      heightCm: Number(form.heightCm),
      weightKg: Number(form.weightKg),
      targetWeightKg: Number(form.targetWeightKg),
      timeframeWeeks: Number(form.timeframeWeeks),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    setProfile(profile);
  }

  const preview: Profile = {
    ...form,
    age: Number(form.age),
    heightCm: Number(form.heightCm),
    weightKg: Number(form.weightKg),
    targetWeightKg: Number(form.targetWeightKg),
    timeframeWeeks: Number(form.timeframeWeeks),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  const targets = form.heightCm && form.weightKg && form.age ? planDailyTargets(preview) : null;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView className="flex-1 px-5 py-4" contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <Text className="text-2xl font-bold mb-1" style={{ color: colors.textPrimary }}>
          Edit Profile
        </Text>
        <Text className="text-sm mb-6" style={{ color: colors.textSecondary }}>
          This powers your calorie & macro targets and personalizes your dashboard.
        </Text>

        <View className="gap-6">
          <Card title="About you">
            <View className="flex-row justify-end mb-4">
              <UnitToggle value={form.unitSystem} onChange={(unitSystem) => setForm((f) => ({ ...f, unitSystem }))} />
            </View>
            <View className="gap-4">
              <View>
                <FieldLabel>Name</FieldLabel>
                <TextField value={form.name} onChangeText={(name) => setForm((f) => ({ ...f, name }))} placeholder="Jane Doe" />
              </View>
              <View className="flex-row gap-4">
                <View className="flex-1">
                  <FieldLabel>Age</FieldLabel>
                  <TextField
                    keyboardType="numeric"
                    value={String(form.age)}
                    onChangeText={(v) => setForm((f) => ({ ...f, age: Number(v) || 0 }))}
                  />
                </View>
                <View className="flex-1">
                  <FieldLabel>Sex</FieldLabel>
                  <SelectField
                    value={form.sex}
                    onChange={(sex) => setForm((f) => ({ ...f, sex }))}
                    options={SEXES.map((s) => ({ value: s, label: SEX_LABELS[s] }))}
                  />
                </View>
              </View>
              <View>
                <FieldLabel>Height</FieldLabel>
                <HeightInput
                  valueCm={form.heightCm}
                  onChangeCm={(heightCm) => setForm((f) => ({ ...f, heightCm: heightCm === '' ? 0 : heightCm }))}
                  unit={form.unitSystem}
                />
              </View>
              <View>
                <FieldLabel>Current weight</FieldLabel>
                <WeightInput
                  valueKg={form.weightKg}
                  onChangeKg={(weightKg) => setForm((f) => ({ ...f, weightKg: weightKg === '' ? 0 : weightKg }))}
                  unit={form.unitSystem}
                />
              </View>
            </View>
          </Card>

          <Card title="Your goal">
            <View className="gap-4">
              <View>
                <FieldLabel>Primary goal</FieldLabel>
                <SelectField
                  value={form.goal}
                  onChange={(goal) => setForm((f) => ({ ...f, goal }))}
                  options={GOALS.map((g) => ({ value: g, label: GOAL_LABELS[g] }))}
                />
              </View>
              <View className="flex-row gap-4">
                <View className="flex-1">
                  <FieldLabel>Target weight</FieldLabel>
                  <WeightInput
                    valueKg={form.targetWeightKg}
                    onChangeKg={(targetWeightKg) => setForm((f) => ({ ...f, targetWeightKg: targetWeightKg === '' ? 0 : targetWeightKg }))}
                    unit={form.unitSystem}
                  />
                </View>
                <View className="flex-1">
                  <FieldLabel>Timeframe (weeks)</FieldLabel>
                  <TextField
                    keyboardType="numeric"
                    value={String(form.timeframeWeeks)}
                    onChangeText={(v) => setForm((f) => ({ ...f, timeframeWeeks: Number(v) || 0 }))}
                  />
                </View>
              </View>
              <View>
                <FieldLabel>Activity level</FieldLabel>
                <SelectField
                  value={form.activityLevel}
                  onChange={(activityLevel) => setForm((f) => ({ ...f, activityLevel }))}
                  options={ACTIVITIES.map((a) => ({ value: a, label: ACTIVITY_LABELS[a] }))}
                />
              </View>
              <View>
                <FieldLabel>How many days a week can you train?</FieldLabel>
                <TextField
                  keyboardType="numeric"
                  value={String(form.preferredDaysPerWeek)}
                  onChangeText={(v) => setForm((f) => ({ ...f, preferredDaysPerWeek: Number(v) || 0 }))}
                />
              </View>
              <View>
                <FieldLabel>What do you expect to achieve? (optional notes)</FieldLabel>
                <TextField
                  multiline
                  numberOfLines={3}
                  value={form.expectations}
                  onChangeText={(expectations) => setForm((f) => ({ ...f, expectations }))}
                  placeholder="e.g. Lose 5kg and feel stronger in daily life, be able to do 10 pull-ups, run a 5k..."
                  style={{ minHeight: 84, textAlignVertical: 'top' }}
                />
              </View>
            </View>
          </Card>

          {targets && (
            <Card title="Your calculated daily targets">
              <View className="flex-row flex-wrap gap-4 justify-around">
                {[
                  { value: `${targets.calories}`, label: 'kcal / day' },
                  { value: `${targets.proteinG}g`, label: 'protein' },
                  { value: `${targets.carbsG}g`, label: 'carbs' },
                  { value: `${targets.fatG}g`, label: 'fat' },
                ].map((s) => (
                  <View key={s.label} className="items-center">
                    <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>
                      {s.value}
                    </Text>
                    <Text className="text-xs" style={{ color: colors.textMuted }}>
                      {s.label}
                    </Text>
                  </View>
                ))}
              </View>
              <Text className="text-xs mt-3 text-center" style={{ color: colors.textMuted }}>
                BMI: {bmi(preview).toFixed(1)} — targets recalculate automatically as your weight & activity change.
              </Text>
              <TargetPlanNote profile={preview} plan={targets} />
            </Card>
          )}

          <PressableScale hapticStyle="success"
            onPress={submit}
            className="w-full py-3.5 rounded-full items-center"
            style={{ backgroundColor: colors.brandPrimaryDark }}
          >
            <Text className="text-white font-semibold">Save Changes</Text>
          </PressableScale>

          <Card title="Account">
            {authEmail && (
              <Text className="text-sm mb-4" style={{ color: colors.textSecondary }}>
                Signed in as {authEmail}
              </Text>
            )}
            <PressableScale
              onPress={() =>
                Alert.alert('Sign out', 'You can sign back in any time to pick up where you left off.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
                ])
              }
              className="flex-row items-center justify-center gap-2 py-2.5 rounded-lg border"
              style={{ borderColor: colors.gridline }}
            >
              <LogOut size={15} color={colors.statusCritical} />
              <Text className="text-sm font-medium" style={{ color: colors.statusCritical }}>
                Sign out
              </Text>
            </PressableScale>

            <PressableScale hapticStyle="warning"
              onPress={confirmDeleteAccount}
              disabled={deleting}
              className="flex-row items-center justify-center gap-2 py-2.5 rounded-lg border mt-2"
              style={{ borderColor: colors.gridline, opacity: deleting ? 0.5 : 1 }}
            >
              {deleting ? (
                <ActivityIndicator size="small" color={colors.statusCritical} />
              ) : (
                <Trash2 size={15} color={colors.statusCritical} />
              )}
              <Text className="text-sm font-medium" style={{ color: colors.statusCritical }}>
                {deleting ? 'Deleting…' : 'Delete Account'}
              </Text>
            </PressableScale>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
