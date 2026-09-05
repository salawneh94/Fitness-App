import { useState } from 'react';
import { ArrowLeft, Minus, Plus, Check, Sparkles } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';
import type { ActivityLevel, Goal, Profile, Sex, UnitSystem } from '@fittrack/shared';
import { ACTIVITY_LABELS, GOAL_LABELS, planDailyTargets, recommendPlan, colors } from '@fittrack/shared';
import TargetPlanNote from './target-plan-note';
import WeightInput from './ui/weight-input';
import HeightInput from './ui/height-input';
import UnitToggle from './ui/unit-toggle';
import TextField from './ui/text-field';
import PressableScale from '@/components/ui/pressable-scale';
import { buildScheduledWorkouts } from '@/lib/apply-plan';

const GOALS: Goal[] = ['lose_fat', 'build_muscle', 'maintain', 'improve_endurance', 'general_health'];
const ACTIVITIES: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const STEP_COUNT = 8;

interface WizardForm {
  name: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  goal: Goal;
  targetWeightKg: number;
  timeframeWeeks: number;
  expectations: string;
  activityLevel: ActivityLevel;
  preferredDaysPerWeek: number;
  unitSystem: UnitSystem;
}

export default function OnboardingWizard() {
  const setProfile = useAppStore((s) => s.setProfile);
  const setScheduledWorkouts = useAppStore((s) => s.setScheduledWorkouts);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>({
    name: '',
    age: 28,
    sex: 'male',
    heightCm: 175,
    weightKg: 75,
    goal: 'build_muscle',
    targetWeightKg: 75,
    timeframeWeeks: 12,
    expectations: '',
    activityLevel: 'moderate',
    preferredDaysPerWeek: 4,
    unitSystem: 'metric',
  });

  function patch(update: Partial<WizardForm>) {
    setForm((f) => ({ ...f, ...update }));
  }

  function finish() {
    const profile: Profile = { ...form, createdAt: new Date().toISOString() };
    setProfile(profile);
    // Onboarding already asked for the goal, activity level and days-per-week that
    // recommendPlan needs, so there's no reason to drop the user into an empty week and make
    // them go find the Plans tab. Only seed when the schedule is genuinely empty — a returning
    // user re-running onboarding shouldn't have their own plan overwritten.
    if (useAppStore.getState().scheduledWorkouts.length === 0) {
      const recommendation = recommendPlan(profile);
      if (recommendation) setScheduledWorkouts(buildScheduledWorkouts(recommendation.template));
    }
  }

  const canProceed = [
    form.name.trim().length > 0,
    true,
    form.age >= 13 && form.age <= 100,
    form.heightCm >= 100 && form.heightCm <= 250 && form.weightKg >= 30 && form.weightKg <= 300,
    true,
    true,
    form.targetWeightKg >= 30 && form.timeframeWeeks >= 1,
    true,
  ][step];

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-1 px-6 py-4 max-w-md w-full self-center">
        <View className="flex-row items-center justify-between mb-6">
          <PressableScale hapticStyle="selection"
            onPress={() => setStep((s) => Math.max(0, s - 1))}
            className="p-2 -ml-2"
            style={{ opacity: step === 0 ? 0 : 1 }}
            disabled={step === 0}
          >
            <ArrowLeft size={20} color={colors.textPrimary} />
          </PressableScale>
          <View className="flex-row gap-1.5">
            {Array.from({ length: STEP_COUNT }).map((_, i) => (
              <View
                key={i}
                className="h-1.5 rounded-full"
                style={{ width: i === step ? 20 : 6, backgroundColor: i <= step ? colors.brandPrimary : colors.gridline }}
              />
            ))}
          </View>
          <View className="w-9" />
        </View>

        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {step === 0 && <StepName value={form.name} onChange={(name) => patch({ name })} />}
          {step === 1 && <StepSex value={form.sex} onChange={(sex) => patch({ sex })} />}
          {step === 2 && <StepAge value={form.age} onChange={(age) => patch({ age })} />}
          {step === 3 && (
            <StepBody
              heightCm={form.heightCm}
              weightKg={form.weightKg}
              unit={form.unitSystem}
              onHeight={(heightCm) => patch({ heightCm })}
              onWeight={(weightKg) => patch({ weightKg })}
              onUnit={(unitSystem) => patch({ unitSystem })}
            />
          )}
          {step === 4 && <StepGoal value={form.goal} onChange={(goal) => patch({ goal })} />}
          {step === 5 && (
            <StepActivity
              activityLevel={form.activityLevel}
              preferredDaysPerWeek={form.preferredDaysPerWeek}
              onActivity={(activityLevel) => patch({ activityLevel })}
              onDays={(preferredDaysPerWeek) => patch({ preferredDaysPerWeek })}
            />
          )}
          {step === 6 && (
            <StepTarget
              targetWeightKg={form.targetWeightKg}
              timeframeWeeks={form.timeframeWeeks}
              expectations={form.expectations}
              unit={form.unitSystem}
              onTargetWeight={(targetWeightKg) => patch({ targetWeightKg })}
              onTimeframe={(timeframeWeeks) => patch({ timeframeWeeks })}
              onExpectations={(expectations) => patch({ expectations })}
            />
          )}
          {step === 7 && <StepReview form={form} />}
        </ScrollView>

        <PressableScale
          onPress={() => (step === STEP_COUNT - 1 ? finish() : setStep((s) => s + 1))}
          disabled={!canProceed}
          className="w-full py-3.5 rounded-full mt-6 items-center"
          style={{ backgroundColor: colors.brandPrimaryDark, opacity: canProceed ? 1 : 0.4 }}
        >
          <Text className="text-white font-semibold">{step === STEP_COUNT - 1 ? 'Start Tracking' : 'Continue'}</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

function StepHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <View className="mb-8">
      <Text className="text-2xl font-bold mb-2" style={{ color: colors.textPrimary }}>
        {title}
      </Text>
      <Text className="text-sm" style={{ color: colors.textSecondary }}>
        {sub}
      </Text>
    </View>
  );
}

function OptionButton({ selected, onPress, children }: { selected: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <PressableScale
      onPress={onPress}
      className="w-full flex-row items-center justify-between px-5 py-4 rounded-2xl border-2"
      style={{
        borderColor: selected ? colors.brandPrimary : colors.gridline,
        backgroundColor: selected ? 'rgba(34, 211, 238, 0.1)' : 'transparent',
      }}
    >
      {children}
    </PressableScale>
  );
}

function StepName({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View>
      <StepHeader title="What's your name?" sub="So we can personalize your experience." />
      <TextField autoFocus value={value} onChangeText={onChange} placeholder="Jane Doe" />
    </View>
  );
}

function StepSex({ value, onChange }: { value: Sex; onChange: (v: Sex) => void }) {
  const options: { key: Sex; label: string }[] = [
    { key: 'male', label: 'Male' },
    { key: 'female', label: 'Female' },
    { key: 'other', label: 'Other' },
  ];
  return (
    <View>
      <StepHeader title="Tell us about yourself" sub="This helps us tailor your calorie targets." />
      <View className="gap-3">
        {options.map((o) => (
          <OptionButton key={o.key} selected={value === o.key} onPress={() => onChange(o.key)}>
            <Text className="font-medium" style={{ color: colors.textPrimary }}>
              {o.label}
            </Text>
          </OptionButton>
        ))}
      </View>
    </View>
  );
}

function StepAge({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View>
      <StepHeader title="How old are you?" sub="This helps us create your personalized plan." />
      <View className="flex-row items-center justify-center gap-6">
        <PressableScale hapticStyle="selection"
          onPress={() => onChange(Math.max(13, value - 1))}
          className="w-11 h-11 rounded-full border items-center justify-center"
          style={{ borderColor: colors.gridline }}
        >
          <Minus size={18} color={colors.textPrimary} />
        </PressableScale>
        <Text className="text-5xl font-bold w-24 text-center" style={{ color: colors.textPrimary }}>
          {value}
        </Text>
        <PressableScale hapticStyle="selection"
          onPress={() => onChange(Math.min(100, value + 1))}
          className="w-11 h-11 rounded-full border items-center justify-center"
          style={{ borderColor: colors.gridline }}
        >
          <Plus size={18} color={colors.textPrimary} />
        </PressableScale>
      </View>
    </View>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-sm font-medium mb-1.5" style={{ color: colors.textSecondary }}>
      {children}
    </Text>
  );
}

function StepBody({
  heightCm,
  weightKg,
  unit,
  onHeight,
  onWeight,
  onUnit,
}: {
  heightCm: number;
  weightKg: number;
  unit: UnitSystem;
  onHeight: (cm: number) => void;
  onWeight: (kg: number) => void;
  onUnit: (u: UnitSystem) => void;
}) {
  return (
    <View>
      <StepHeader title="Height & weight" sub="Used to calculate your daily calorie and macro targets." />
      <View className="flex-row justify-end mb-4">
        <UnitToggle value={unit} onChange={onUnit} />
      </View>
      <View className="gap-4">
        <View>
          <FieldLabel>Height</FieldLabel>
          <HeightInput valueCm={heightCm} onChangeCm={(v) => onHeight(v === '' ? 0 : v)} unit={unit} />
        </View>
        <View>
          <FieldLabel>Current weight</FieldLabel>
          <WeightInput valueKg={weightKg} onChangeKg={(v) => onWeight(v === '' ? 0 : v)} unit={unit} />
        </View>
      </View>
    </View>
  );
}

function StepGoal({ value, onChange }: { value: Goal; onChange: (g: Goal) => void }) {
  return (
    <View>
      <StepHeader title="What's your goal?" sub="This shapes your calorie targets and plan recommendations." />
      <View className="gap-2.5">
        {GOALS.map((g) => (
          <OptionButton key={g} selected={value === g} onPress={() => onChange(g)}>
            <Text className="font-medium" style={{ color: colors.textPrimary }}>
              {GOAL_LABELS[g]}
            </Text>
            {value === g && (
              <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.brandPrimaryDark }}>
                <Check size={13} color="#fff" />
              </View>
            )}
          </OptionButton>
        ))}
      </View>
    </View>
  );
}

function StepActivity({
  activityLevel,
  preferredDaysPerWeek,
  onActivity,
  onDays,
}: {
  activityLevel: ActivityLevel;
  preferredDaysPerWeek: number;
  onActivity: (a: ActivityLevel) => void;
  onDays: (d: number) => void;
}) {
  return (
    <View>
      <StepHeader title="How active are you?" sub="We'll use this to fine-tune your calorie targets." />
      <View className="gap-2.5 mb-6">
        {ACTIVITIES.map((a) => (
          <OptionButton key={a} selected={activityLevel === a} onPress={() => onActivity(a)}>
            <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
              {ACTIVITY_LABELS[a]}
            </Text>
          </OptionButton>
        ))}
      </View>
      <View>
        <FieldLabel>How many days a week can you train?</FieldLabel>
        <TextField
          keyboardType="numeric"
          value={String(preferredDaysPerWeek)}
          onChangeText={(v) => onDays(Number(v) || 0)}
        />
      </View>
    </View>
  );
}

function StepTarget({
  targetWeightKg,
  timeframeWeeks,
  expectations,
  unit,
  onTargetWeight,
  onTimeframe,
  onExpectations,
}: {
  targetWeightKg: number;
  timeframeWeeks: number;
  expectations: string;
  unit: UnitSystem;
  onTargetWeight: (kg: number) => void;
  onTimeframe: (weeks: number) => void;
  onExpectations: (v: string) => void;
}) {
  return (
    <View>
      <StepHeader title="Set your target" sub="What are you aiming for, and by when?" />
      <View className="gap-4">
        <View className="flex-row gap-3">
          <View className="flex-1">
            <FieldLabel>Target weight</FieldLabel>
            <WeightInput valueKg={targetWeightKg} onChangeKg={(v) => onTargetWeight(v === '' ? 0 : v)} unit={unit} />
          </View>
          <View className="flex-1">
            <FieldLabel>Timeframe (weeks)</FieldLabel>
            <TextField
              keyboardType="numeric"
              value={String(timeframeWeeks)}
              onChangeText={(v) => onTimeframe(Number(v) || 0)}
            />
          </View>
        </View>
        <View>
          <FieldLabel>What do you expect to achieve? (optional)</FieldLabel>
          <TextField
            multiline
            numberOfLines={3}
            value={expectations}
            onChangeText={onExpectations}
            placeholder="e.g. Lose 5kg and feel stronger in daily life, be able to do 10 pull-ups, run a 5k..."
            style={{ minHeight: 84, textAlignVertical: 'top' }}
          />
        </View>
      </View>
    </View>
  );
}

function StepReview({ form }: { form: WizardForm }) {
  const profile: Profile = { ...form, createdAt: new Date().toISOString() };
  const targets = planDailyTargets(profile);
  const recommendation = recommendPlan(profile);
  const stats = [
    { value: `${targets.calories}`, label: 'kcal / day' },
    { value: `${targets.proteinG}g`, label: 'protein' },
    { value: `${targets.carbsG}g`, label: 'carbs' },
    { value: `${targets.fatG}g`, label: 'fat' },
  ];
  return (
    <View>
      <StepHeader title={`You're all set, ${form.name.split(' ')[0]}`} sub="Here's what we calculated for your daily targets." />
      <View className="flex-row flex-wrap gap-3 mb-4">
        {stats.map((s) => (
          <View
            key={s.label}
            className="rounded-2xl border py-4 items-center"
            style={{ borderColor: colors.gridline, width: '47%' }}
          >
            <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>
              {s.value}
            </Text>
            <Text className="text-xs" style={{ color: colors.textMuted }}>
              {s.label}
            </Text>
          </View>
        ))}
      </View>
      <TargetPlanNote profile={profile} plan={targets} />

      {recommendation && (
        <View
          className="flex-row items-start gap-3 p-4 rounded-2xl border mt-4"
          style={{ backgroundColor: 'rgba(34,211,238,0.08)', borderColor: colors.brandPrimary }}
        >
          <Sparkles size={18} color={colors.brandPrimary} style={{ marginTop: 2 }} />
          <View className="flex-1">
            <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
              We'll start you on {recommendation.template.name}
            </Text>
            <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
              {recommendation.reason} Swap it for any other plan from the Plans tab whenever you like.
            </Text>
          </View>
        </View>
      )}

      <Text className="text-xs text-center mt-4" style={{ color: colors.textMuted }}>
        You can fine-tune anything later from your Profile page.
      </Text>
    </View>
  );
}
