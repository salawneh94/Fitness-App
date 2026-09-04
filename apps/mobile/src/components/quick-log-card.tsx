import { useState } from 'react';
import { Check } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { useAppStore } from '@/store/useAppStore';
import { todayISO, colors } from '@fittrack/shared';
import Card from './ui/card';
import WeightInput from './ui/weight-input';
import TextField from './ui/text-field';
import PressableScale from '@/components/ui/pressable-scale';

export default function QuickLogCard() {
  const profile = useAppStore((s) => s.profile);
  const weightHistory = useAppStore((s) => s.weightHistory);
  const stepsHistory = useAppStore((s) => s.stepsHistory);
  const sleepHistory = useAppStore((s) => s.sleepHistory);
  const updateWeight = useAppStore((s) => s.updateWeight);
  const updateSteps = useAppStore((s) => s.updateSteps);
  const updateSleep = useAppStore((s) => s.updateSleep);

  const today = todayISO();
  const todayWeight = weightHistory.find((w) => w.date === today)?.weightKg ?? profile?.weightKg ?? '';
  const todaySteps = stepsHistory.find((s) => s.date === today)?.steps ?? '';
  const todaySleep = sleepHistory.find((s) => s.date === today)?.hours ?? '';

  const [weight, setWeight] = useState<number | ''>(todayWeight);
  const [steps, setSteps] = useState<number | ''>(todaySteps);
  const [sleep, setSleep] = useState<number | ''>(todaySleep);
  const [saved, setSaved] = useState(false);

  function save() {
    if (weight !== '') updateWeight(Number(weight));
    if (steps !== '') updateSteps(Number(steps));
    if (sleep !== '') updateSleep(Number(sleep));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <Card title="Log Today">
      <View className="flex-row gap-3 mb-3">
        <View className="flex-1">
          <Text className="text-xs font-medium mb-1" style={{ color: colors.textMuted }}>
            Weight
          </Text>
          <WeightInput valueKg={weight} onChangeKg={setWeight} unit={profile?.unitSystem ?? 'metric'} />
        </View>
        <View className="flex-1">
          <Text className="text-xs font-medium mb-1" style={{ color: colors.textMuted }}>
            Steps
          </Text>
          <TextField
            keyboardType="numeric"
            value={steps === '' ? '' : String(steps)}
            onChangeText={(v) => setSteps(v === '' ? '' : Number(v))}
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
          />
        </View>
      </View>
      <PressableScale hapticStyle="success"
        onPress={save}
        className="flex-row items-center justify-center gap-1.5 px-4 py-2 rounded-full self-start"
        style={{ backgroundColor: colors.brandPrimaryDark }}
      >
        {saved && <Check size={15} color="#fff" />}
        <Text className="text-white text-sm font-semibold">{saved ? 'Saved' : 'Save'}</Text>
      </PressableScale>
    </Card>
  );
}
