import { useState } from 'react';
import { Check } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { useAppStore } from '@/store/useAppStore';
import { checkWeighIn, isValidSleepHours, isValidSteps, todayISO, colors } from '@fittrack/shared';
import { weighInMessage } from '@/lib/entry-messages';
import Card from './ui/card';
import WeightInput from './ui/weight-input';
import TextField from './ui/text-field';
import DayChips from './ui/day-chips';
import PressableScale from '@/components/ui/pressable-scale';

/**
 * Weight, steps and sleep for today — or for a day this week that didn't get logged.
 *
 * Each field holds only what was actually recorded for the chosen day. The last known weight is
 * shown as a greyed-out hint, never as a value: pre-filling it meant that saving steps alone also
 * logged "same weight as before" for a day nobody stepped on a scale, and a run of those readings
 * flattens the trend that the insights and the measured maintenance are fitted through.
 */
export default function QuickLogCard() {
  const today = todayISO();
  const [date, setDate] = useState(today);

  return (
    <Card title={date === today ? 'Log Today' : 'Log a past day'}>
      <View className="mb-3">
        <DayChips value={date} onChange={setDate} />
      </View>
      {/* Keyed by day: switching days loads that day's values instead of carrying the last day's
          typing over to it. */}
      <QuickLogFields key={date} date={date} />
    </Card>
  );
}

function QuickLogFields({ date }: { date: string }) {
  const profile = useAppStore((s) => s.profile);
  const weightHistory = useAppStore((s) => s.weightHistory);
  const stepsHistory = useAppStore((s) => s.stepsHistory);
  const sleepHistory = useAppStore((s) => s.sleepHistory);
  const updateWeight = useAppStore((s) => s.updateWeight);
  const updateSteps = useAppStore((s) => s.updateSteps);
  const updateSleep = useAppStore((s) => s.updateSleep);

  const [weight, setWeight] = useState<number | ''>(() => weightHistory.find((w) => w.date === date)?.weightKg ?? '');
  const [steps, setSteps] = useState<number | ''>(() => stepsHistory.find((s) => s.date === date)?.steps ?? '');
  const [sleep, setSleep] = useState<number | ''>(() => sleepHistory.find((s) => s.date === date)?.hours ?? '');
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Set once an unusual weight has been pointed out; pressing Save again then means "yes, really".
  const [confirming, setConfirming] = useState(false);

  // The hint is the weight as of that day: the latest weigh-in on or before it.
  const hintKg =
    weightHistory.filter((w) => w.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0]?.weightKg ?? profile?.weightKg;

  const nothingEntered = weight === '' && steps === '' && sleep === '';

  const storedWeight = weightHistory.find((w) => w.date === date)?.weightKg;

  function save() {
    if (nothingEntered) return;
    if (steps !== '' && !isValidSteps(Number(steps))) return setProblem('Steps should be a whole number up to 100,000.');
    if (sleep !== '' && !isValidSleepHours(Number(sleep))) return setProblem('Sleep should be between 0 and 24 hours.');
    // Only a changed weight is checked: re-saving the day to add steps mustn't re-question a
    // reading already confirmed.
    if (weight !== '' && Number(weight) !== storedWeight) {
      const check = checkWeighIn(Number(weight), date, weightHistory);
      if (check.kind === 'invalid' || (check.kind === 'unusual' && !confirming)) {
        setProblem(weighInMessage(check, profile?.unitSystem ?? 'metric'));
        setConfirming(check.kind === 'unusual');
        return;
      }
    }
    setProblem(null);
    setConfirming(false);
    if (weight !== '') updateWeight(Number(weight), date);
    if (steps !== '') updateSteps(Number(steps), date);
    if (sleep !== '') updateSleep(Number(sleep), date);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <>
      <View className="flex-row gap-3 mb-3">
        <View className="flex-1">
          <Text className="text-xs font-medium mb-1" style={{ color: colors.textMuted }}>
            Weight
          </Text>
          <WeightInput
            valueKg={weight}
            onChangeKg={(v) => {
              setWeight(v);
              setProblem(null);
              setConfirming(false);
            }}
            unit={profile?.unitSystem ?? 'metric'}
            placeholderKg={hintKg}
            accessibilityLabel="Weight"
          />
        </View>
        <View className="flex-1">
          <Text className="text-xs font-medium mb-1" style={{ color: colors.textMuted }}>
            Steps
          </Text>
          <TextField
            keyboardType="numeric"
            value={steps === '' ? '' : String(steps)}
            onChangeText={(v) => {
              setSteps(v === '' ? '' : Number(v));
              setProblem(null);
            }}
            accessibilityLabel="Steps"
          />
        </View>
        <View className="flex-1">
          <Text className="text-xs font-medium mb-1" style={{ color: colors.textMuted }}>
            Sleep (hrs)
          </Text>
          <TextField
            keyboardType="numeric"
            value={sleep === '' ? '' : String(sleep)}
            onChangeText={(v) => {
              setSleep(v === '' ? '' : Number(v));
              setProblem(null);
            }}
            accessibilityLabel="Sleep in hours"
          />
        </View>
      </View>
      {problem && (
        <Text className="text-xs mb-3" style={{ color: colors.statusWarning }} accessibilityLiveRegion="polite">
          {problem}
        </Text>
      )}
      <PressableScale
        hapticStyle="success"
        onPress={save}
        disabled={nothingEntered}
        className="flex-row items-center justify-center gap-1.5 px-4 py-2 rounded-full self-start"
        style={{ backgroundColor: colors.brandPrimaryDark, opacity: nothingEntered ? 0.5 : 1 }}
      >
        {saved && <Check size={15} color="#fff" />}
        <Text className="text-white text-sm font-semibold">{saved ? 'Saved' : confirming ? 'Save anyway' : 'Save'}</Text>
      </PressableScale>
    </>
  );
}
