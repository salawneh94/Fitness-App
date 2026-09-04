import { useMemo } from 'react';
import { Link } from 'expo-router';
import { Flame, Clock, Target, TrendingUp, Pencil, Zap } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';
import { calcDailyTargets, GOAL_LABELS, todayISO } from '@fittrack/shared';
import { computeStreaks, computeRestDayInsight } from '@fittrack/shared';
import { displayWeight, formatHeight, formatWeight, weightUnitLabel, colors } from '@fittrack/shared';
import type { Micronutrients } from '@fittrack/shared';
import Card from '@/components/ui/card';
import StatTile from '@/components/ui/stat-tile';
import CountUp from '@/components/ui/count-up';
import CalorieRing from '@/components/charts/calorie-ring';
import MacroBars from '@/components/charts/macro-bars';
import MicronutrientList from '@/components/micronutrient-list';
import RestDayBanner from '@/components/rest-day-banner';
import QuickLogCard from '@/components/quick-log-card';
import MotivationalTagline from '@/components/motivational-tagline';
import Confetti from '@/components/confetti';
import { useStreakCelebration } from '@/hooks/use-streak-celebration';

export default function OverviewScreen() {
  const profile = useAppStore((s) => s.profile)!; // gated by root layout
  const foodEntries = useAppStore((s) => s.foodEntries);
  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const weightHistory = useAppStore((s) => s.weightHistory);

  const today = todayISO();

  // These all walk the user's full history, so they're memoized rather than recomputed on every
  // render — by the time someone has a year of logs, `foodEntries` alone is thousands of rows.
  const todaysFood = useMemo(() => foodEntries.filter((f) => f.date === today), [foodEntries, today]);
  const todaysWorkouts = useMemo(() => workoutLogs.filter((w) => w.date === today), [workoutLogs, today]);

  const consumed = useMemo(
    () =>
      todaysFood.reduce(
        (acc, f) => ({
          calories: acc.calories + f.calories * f.quantity,
          proteinG: acc.proteinG + f.proteinG * f.quantity,
          carbsG: acc.carbsG + f.carbsG * f.quantity,
          fatG: acc.fatG + f.fatG * f.quantity,
        }),
        { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
      ),
    [todaysFood]
  );

  const microTotals = useMemo(() => {
    const totals: Micronutrients = {};
    for (const f of todaysFood) {
      if (!f.micros) continue;
      for (const [k, v] of Object.entries(f.micros)) {
        if (typeof v !== 'number') continue;
        const key = k as keyof Micronutrients;
        totals[key] = (totals[key] ?? 0) + v * f.quantity;
      }
    }
    return totals;
  }, [todaysFood]);

  const targets = useMemo(() => calcDailyTargets(profile), [profile]);

  const { workoutMinutesToday, caloriesBurnedToday } = useMemo(
    () => ({
      workoutMinutesToday: todaysWorkouts.reduce((sum, w) => sum + w.durationMin, 0),
      caloriesBurnedToday: todaysWorkouts.reduce((sum, w) => sum + (w.caloriesBurned ?? 0), 0),
    }),
    [todaysWorkouts]
  );

  const weeklyMinutes = useMemo(() => {
    const now = Date.now();
    return workoutLogs
      .filter((w) => {
        const diffDays = (now - new Date(w.date).getTime()) / 86400000;
        return diffDays >= 0 && diffDays < 7;
      })
      .reduce((sum, w) => sum + w.durationMin, 0);
  }, [workoutLogs]);

  const startWeight = weightHistory[0]?.weightKg ?? profile.weightKg;
  const weightDelta = profile.weightKg - startWeight;

  const streaks = useMemo(
    () => computeStreaks(foodEntries, workoutLogs, profile.createdAt.slice(0, 10)),
    [foodEntries, workoutLogs, profile.createdAt]
  );
  const celebrating = useStreakCelebration(streaks.currentStreak);
  const restInsight = useMemo(() => computeRestDayInsight(workoutLogs), [workoutLogs]);

  const summaryStats = useMemo(
    () => [
      { label: 'Age', value: `${profile.age}` },
      { label: 'Height', value: formatHeight(profile.heightCm, profile.unitSystem) },
      { label: 'Weight', value: formatWeight(profile.weightKg, profile.unitSystem) },
      { label: 'Goal', value: GOAL_LABELS[profile.goal] },
      ...(profile.targetWeightKg
        ? [{ label: 'Target', value: `${formatWeight(profile.targetWeightKg, profile.unitSystem)} in ${profile.timeframeWeeks}w` }]
        : []),
    ],
    [profile]
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }} edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 16, gap: 24 }}>
        {restInsight.shouldRest && <RestDayBanner consecutiveDays={restInsight.consecutiveTrainedDays} />}

        <View
          className="relative overflow-hidden rounded-3xl p-6"
          style={{ backgroundColor: colors.brandPrimaryDark }}
        >
          {celebrating && <Confetti />}
          <View className="flex-row items-start justify-between gap-4">
            <View className="flex-1 min-w-0">
              <Text className="text-2xl font-bold text-white">Welcome back, {profile.name.split(' ')[0]}</Text>
              <Text className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
              <View className="flex-row items-center gap-1.5 mt-3">
                <Flame size={14} color={celebrating ? '#fde68a' : '#fcd34d'} />
                {celebrating ? (
                  <Text className="text-sm font-semibold" style={{ color: '#fde68a' }}>
                    {streaks.currentStreak}-day streak! You're on fire — keep it going.
                  </Text>
                ) : (
                  <MotivationalTagline />
                )}
              </View>
            </View>
            <Link href="/profile" asChild>
              <Pressable
                className="flex-row items-center gap-1.5 px-3.5 py-2 rounded-full"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
              >
                <Pencil size={14} color="#fff" />
                <Text className="text-white text-sm">Edit Profile</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        <Card>
          <View className="flex-row flex-wrap gap-x-8 gap-y-3">
            {summaryStats.map((s) => (
              <View key={s.label}>
                <Text className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
                  {s.label}
                </Text>
                <Text className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                  {s.value}
                </Text>
              </View>
            ))}
          </View>
          {profile.expectations ? (
            <View className="flex-row items-start gap-1.5 mt-3 pt-3 border-t" style={{ borderColor: colors.gridline }}>
              <Target size={14} color={colors.textSecondary} style={{ marginTop: 2 }} />
              <Text className="text-sm flex-1" style={{ color: colors.textSecondary }}>
                {profile.expectations}
              </Text>
            </View>
          ) : null}
        </Card>

        <QuickLogCard />

        <View className="flex-row flex-wrap gap-4">
          <View style={{ width: '47%' }}>
            <StatTile
              icon={Flame}
              label="Calories Left Today"
              value={<CountUp value={Math.max(0, Math.round(targets.calories - consumed.calories + caloriesBurnedToday))} />}
              sub={`of ${targets.calories} kcal`}
              accent={colors.series1}
            />
          </View>
          <View style={{ width: '47%' }}>
            <StatTile
              icon={Clock}
              label="Workout Time Today"
              value={<CountUp value={workoutMinutesToday} suffix=" min" />}
              sub={todaysWorkouts.map((w) => w.workoutName).join(', ') || 'No workout logged yet'}
              accent={colors.series3}
            />
          </View>
          <View style={{ width: '47%' }}>
            <StatTile
              icon={TrendingUp}
              label="This Week"
              value={<CountUp value={weeklyMinutes} suffix=" min" />}
              sub="total training time"
              accent={colors.series2}
            />
          </View>
          <View style={{ width: '47%' }}>
            <StatTile
              icon={Target}
              label="Weight Change"
              value={
                <CountUp
                  value={displayWeight(weightDelta, profile.unitSystem)}
                  formatter={(n) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}`}
                />
              }
              sub={`${weightUnitLabel(profile.unitSystem)} since ${weightHistory[0] ? new Date(weightHistory[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'start'}`}
              accent={colors.series4}
            />
          </View>
          <View style={{ width: '100%' }}>
            <StatTile
              icon={Zap}
              label="Current Streak"
              value={<CountUp value={streaks.currentStreak} suffix="d" />}
              sub="days logged in a row"
              accent={colors.brandLime}
            />
          </View>
        </View>

        <Card title="Calories Remaining">
          <CalorieRing consumed={consumed.calories} target={targets.calories} burned={caloriesBurnedToday} />
        </Card>

        <Card title="Macros — Consumed vs Target">
          <MacroBars
            protein={{ consumed: consumed.proteinG, target: targets.proteinG }}
            carbs={{ consumed: consumed.carbsG, target: targets.carbsG }}
            fat={{ consumed: consumed.fatG, target: targets.fatG }}
          />
        </Card>

        <Card title="Micronutrients Today">
          {todaysFood.length === 0 ? (
            <Text className="text-sm" style={{ color: colors.textMuted }}>
              No food logged yet today.{' '}
              <Link href="/nutrition" style={{ color: colors.brandPrimary, textDecorationLine: 'underline' }}>
                Log a meal
              </Link>{' '}
              to see your micronutrient breakdown.
            </Text>
          ) : (
            <MicronutrientList totals={microTotals} />
          )}
        </Card>

        <Link href="/progress" asChild>
          <Pressable
            className="flex-row items-center justify-between p-4 rounded-2xl border"
            style={{ backgroundColor: colors.chartSurface, borderColor: colors.gridline }}
          >
            <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
              View weight trend, strength gains & progress photos
            </Text>
            <Text className="text-sm font-medium" style={{ color: colors.brandPrimary }}>
              Progress →
            </Text>
          </Pressable>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}
