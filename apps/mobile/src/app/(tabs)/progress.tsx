import { useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import { Award, CalendarCheck, Camera, Flame, Plus, Trash2 } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';
import {
  SLEEP_GOAL_HOURS,
  STEP_GOAL,
  calcDailyTargets,
  colors,
  computeStreaks,
  displayWeight,
  estimate1RM,
  todayISO,
  weightUnitLabel,
} from '@fittrack/shared';
import Card from '@/components/ui/card';
import StatTile from '@/components/ui/stat-tile';
import CountUp from '@/components/ui/count-up';
import RingGauge from '@/components/charts/ring-gauge';
import WeightChart from '@/components/charts/weight-chart';
import StrengthChart from '@/components/charts/strength-chart';
import CalorieTrendChart from '@/components/charts/calorie-trend-chart';
import MeasurementsCard from '@/components/measurements-card';
import PhotoCompareSlider from '@/components/photo-compare-slider';
import { deletePhotoFile, getPhotoUri, savePhotoFromUri } from '@/lib/photo-store';

export default function ProgressScreen() {
  const profile = useAppStore((s) => s.profile)!; // gated by root layout
  const foodEntries = useAppStore((s) => s.foodEntries);
  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const weightHistory = useAppStore((s) => s.weightHistory);
  const stepsHistory = useAppStore((s) => s.stepsHistory);
  const sleepHistory = useAppStore((s) => s.sleepHistory);
  const progressPhotos = useAppStore((s) => s.progressPhotos);
  const addProgressPhoto = useAppStore((s) => s.addProgressPhoto);
  const removeProgressPhoto = useAppStore((s) => s.removeProgressPhoto);

  const streaks = computeStreaks(foodEntries, workoutLogs, profile.createdAt.slice(0, 10));
  const today = todayISO();
  const todaySteps = stepsHistory.find((s) => s.date === today)?.steps ?? 0;
  const todaySleep = sleepHistory.find((s) => s.date === today)?.hours ?? 0;

  const exerciseOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const log of workoutLogs) {
      for (const ex of log.exerciseLogs ?? []) {
        map.set(ex.exerciseId, ex.exerciseName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [workoutLogs]);

  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const activeExercise = selectedExercise || exerciseOptions[0]?.id || '';

  const strengthData = useMemo(() => {
    if (!activeExercise) return [];
    const byDate = new Map<string, number>();
    for (const log of workoutLogs) {
      const exLog = log.exerciseLogs?.find((e) => e.exerciseId === activeExercise);
      if (!exLog) continue;
      const best = Math.max(...exLog.sets.map((s) => estimate1RM(s.weightKg, s.reps)));
      byDate.set(log.date, Math.max(byDate.get(log.date) ?? 0, best));
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value: Math.round(displayWeight(value, profile.unitSystem) * 10) / 10 }));
  }, [workoutLogs, activeExercise, profile.unitSystem]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }} edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 16, gap: 24 }}>
        <View>
          <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
            Progress
          </Text>
          <Text className="text-sm" style={{ color: colors.textSecondary }}>
            Your consistency, strength, and body trends over time.
          </Text>
        </View>

        <View className="flex-row flex-wrap gap-3">
          <View style={{ width: '47%' }}>
            <StatTile icon={Flame} label="Current Streak" value={<CountUp value={streaks.currentStreak} suffix="d" />} sub="active days in a row" accent={colors.brandLime} />
          </View>
          <View style={{ width: '47%' }}>
            <StatTile icon={Award} label="Best Streak" value={<CountUp value={streaks.bestStreak} suffix="d" />} sub="your longest run" accent={colors.series4} />
          </View>
          <View style={{ width: '47%' }}>
            <StatTile
              icon={CalendarCheck}
              label="7-Day Adherence"
              value={<CountUp value={Math.round(streaks.adherence7d * 100)} suffix="%" />}
              sub="days logged this week"
              accent={colors.series1}
            />
          </View>
          <View style={{ width: '47%' }}>
            <StatTile
              icon={CalendarCheck}
              label="30-Day Adherence"
              value={<CountUp value={Math.round(streaks.adherence30d * 100)} suffix="%" />}
              sub="days logged this month"
              accent={colors.series3}
            />
          </View>
        </View>

        <Card title="Today's Activity">
          <View className="flex-row flex-wrap gap-8 justify-around">
            <RingGauge
              value={todaySteps}
              target={STEP_GOAL}
              color={colors.brandLime}
              centerValue={<CountUp value={todaySteps} />}
              centerLabel="steps"
              allowOverTarget={false}
            />
            <RingGauge
              value={todaySleep}
              target={SLEEP_GOAL_HOURS}
              color={colors.series1}
              centerValue={<CountUp value={todaySleep} decimals={1} suffix="h" />}
              centerLabel="sleep"
              allowOverTarget={false}
            />
          </View>
          <Text className="text-xs text-center mt-4" style={{ color: colors.textMuted }}>
            Log steps & sleep from the "Log Today" card on your Overview screen.
          </Text>
        </Card>

        <Card title="Calorie Trend">
          <CalorieTrendChart foodEntries={foodEntries} targetCalories={calcDailyTargets(profile).calories} />
        </Card>

        <Card title="Weight Trend">
          <WeightChart data={weightHistory} unit={profile.unitSystem} />
        </Card>

        <MeasurementsCard unit={profile.unitSystem} />

        <Card title="Strength Progress (estimated 1-rep max)">
          {exerciseOptions.length === 0 ? (
            <Text className="text-sm" style={{ color: colors.textMuted }}>
              Log sets with weight & reps on the Workouts screen to start tracking strength gains here.
            </Text>
          ) : (
            <>
              <View className="flex-row flex-wrap gap-1.5 mb-3">
                {exerciseOptions.map((ex) => {
                  const isSelected = activeExercise === ex.id;
                  return (
                    <Pressable
                      key={ex.id}
                      onPress={() => setSelectedExercise(ex.id)}
                      className="px-2.5 py-1.5 rounded-full border"
                      style={{
                        backgroundColor: isSelected ? colors.brandPrimaryDark : 'transparent',
                        borderColor: isSelected ? colors.brandPrimaryDark : colors.gridline,
                      }}
                    >
                      <Text className="text-xs" style={{ color: isSelected ? 'white' : colors.textSecondary }}>
                        {ex.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <StrengthChart data={strengthData} unit={weightUnitLabel(profile.unitSystem)} />
            </>
          )}
        </Card>

        <PhotosCard photos={progressPhotos} onAdd={addProgressPhoto} onRemove={removeProgressPhoto} />
        <PhotoCompareSlider photos={progressPhotos} />
      </ScrollView>
    </SafeAreaView>
  );
}

function PhotosCard({
  photos,
  onAdd,
  onRemove,
}: {
  photos: { id: string; date: string; note?: string }[];
  onAdd: (photo: { date: string; note?: string }) => string;
  onRemove: (id: string) => void;
}) {
  const [viewing, setViewing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    setBusy(true);
    try {
      const id = randomUUID();
      await savePhotoFromUri(id, result.assets[0].uri);
      onAdd({ date: todayISO() });
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    onRemove(id);
    deletePhotoFile(id);
    setViewing(null);
  }

  const sorted = [...photos].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Card
      title="Progress Photos"
      action={
        <Pressable onPress={handleAdd} disabled={busy} className="flex-row items-center gap-1.5">
          <Camera size={15} color={colors.brandPrimary} />
          <Text className="text-sm font-medium" style={{ color: colors.brandPrimary }}>
            Add photo
          </Text>
        </Pressable>
      }
    >
      {sorted.length === 0 ? (
        <Pressable
          onPress={handleAdd}
          disabled={busy}
          className="items-center gap-2 py-8 rounded-xl border-2 border-dashed"
          style={{ borderColor: colors.gridline }}
        >
          <Plus size={20} color={colors.textMuted} />
          <Text className="text-sm" style={{ color: colors.textMuted }}>
            Take or upload your first progress photo
          </Text>
        </Pressable>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {sorted.map((p) => {
            const uri = getPhotoUri(p.id);
            return (
              <Pressable
                key={p.id}
                onPress={() => setViewing(p.id)}
                className="rounded-lg overflow-hidden"
                style={{ width: '31%', aspectRatio: 1, backgroundColor: colors.chartSurface }}
              >
                {uri && <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />}
                <View
                  className="absolute bottom-0 inset-x-0 items-center py-0.5"
                  style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                >
                  <Text className="text-[10px] text-white">
                    {new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {viewing && (
        <Modal visible animationType="fade" transparent onRequestClose={() => setViewing(null)}>
          <View className="flex-1 items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
            <View className="w-full" style={{ maxWidth: 420 }}>
              {getPhotoUri(viewing) && (
                <Image
                  source={{ uri: getPhotoUri(viewing)! }}
                  style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 16, marginBottom: 12 }}
                  contentFit="cover"
                />
              )}
              <View className="flex-row items-center justify-between">
                <Text className="text-white text-sm">
                  {new Date(photos.find((p) => p.id === viewing)!.date).toLocaleDateString(undefined, {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => handleRemove(viewing)}
                    className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                  >
                    <Trash2 size={14} color={colors.statusCritical} />
                    <Text className="text-sm" style={{ color: colors.statusCritical }}>
                      Delete
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setViewing(null)}
                    className="px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                  >
                    <Text className="text-white text-sm">Close</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </Card>
  );
}
