import { useState } from 'react';
import { Check } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { useAppStore } from '@/store/useAppStore';
import { todayISO, colors } from '@fittrack/shared';
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

  // The hint is the weight as of that day: the latest weigh-in on or before it.
  const hintKg =
    weightHistory.filter((w) => w.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0]?.weightKg ?? profile?.weightKg;

  const nothingEntered = weight === '' && steps === '' && sleep === '';

  function save() {
    if (nothingEntered) return;
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
            onChangeKg={setWeight}
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
            onChangeText={(v) => setSteps(v === '' ? '' : Number(v))}
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
            onChangeText={(v) => setSleep(v === '' ? '' : Number(v))}
            accessibilityLabel="Sleep in hours"
          />
        </View>
      </View>
      <PressableScale
        hapticStyle="success"
        onPress={save}
        disabled={nothingEntered}
        className="flex-row items-center justify-center gap-1.5 px-4 py-2 rounded-full self-start"
        style={{ backgroundColor: colors.brandPrimaryDark, opacity: nothingEntered ? 0.5 : 1 }}
      >
        {saved && <Check size={15} color="#fff" />}
        <Text className="text-white text-sm font-semibold">{saved ? 'Saved' : 'Save'}</Text>
      </PressableScale>
    </>
  );
}
