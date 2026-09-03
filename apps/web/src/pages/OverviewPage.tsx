import { Link } from 'react-router-dom';
import { Flame, Clock, Target, TrendingUp, Pencil, Zap } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { calcDailyTargets, GOAL_LABELS, todayISO } from '@fittrack/shared';
import { computeStreaks, computeRestDayInsight } from '@fittrack/shared';
import { displayWeight, formatHeight, formatWeight, weightUnitLabel } from '@fittrack/shared';
import Card from '../components/ui/Card';
import StatTile from '../components/ui/StatTile';
import CountUp from '../components/ui/CountUp';
import CalorieRing from '../components/charts/CalorieRing';
import MacroBars from '../components/charts/MacroBars';
import MicronutrientList from '../components/MicronutrientList';
import RestDayBanner from '../components/RestDayBanner';
import QuickLogCard from '../components/QuickLogCard';
import MotivationalTagline from '../components/MotivationalTagline';
import Confetti from '../components/Confetti';
import { useStreakCelebration } from '../hooks/useStreakCelebration';
import type { Micronutrients } from '@fittrack/shared';

export default function OverviewPage() {
  const profile = useAppStore((s) => s.profile);
  const foodEntries = useAppStore((s) => s.foodEntries);
  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const weightHistory = useAppStore((s) => s.weightHistory);

  // Computed with a safe fallback so this hook can run before the early return below —
  // hooks can't be called conditionally, but the null-profile case never actually renders it.
  const streaks = computeStreaks(foodEntries, workoutLogs, profile?.createdAt.slice(0, 10) ?? todayISO());
  const celebrating = useStreakCelebration(streaks.currentStreak);

  if (!profile) return null; // App.tsx redirects to /profile when there's no profile

  const today = todayISO();
  const todaysFood = foodEntries.filter((f) => f.date === today);
  const todaysWorkouts = workoutLogs.filter((w) => w.date === today);

  const consumed = todaysFood.reduce(
    (acc, f) => ({
      calories: acc.calories + f.calories * f.quantity,
      proteinG: acc.proteinG + f.proteinG * f.quantity,
      carbsG: acc.carbsG + f.carbsG * f.quantity,
      fatG: acc.fatG + f.fatG * f.quantity,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );

  const microTotals: Micronutrients = {};
  for (const f of todaysFood) {
    if (!f.micros) continue;
    for (const [k, v] of Object.entries(f.micros)) {
      if (typeof v !== 'number') continue;
      const key = k as keyof Micronutrients;
      microTotals[key] = (microTotals[key] ?? 0) + v * f.quantity;
    }
  }

  const targets = calcDailyTargets(profile);
  const workoutMinutesToday = todaysWorkouts.reduce((sum, w) => sum + w.durationMin, 0);
  const caloriesBurnedToday = todaysWorkouts.reduce((sum, w) => sum + (w.caloriesBurned ?? 0), 0);

  const weeklyMinutes = workoutLogs
    .filter((w) => {
      const d = new Date(w.date);
      const now = new Date();
      const diffDays = (now.getTime() - d.getTime()) / 86400000;
      return diffDays >= 0 && diffDays < 7;
    })
    .reduce((sum, w) => sum + w.durationMin, 0);

  const startWeight = weightHistory[0]?.weightKg ?? profile.weightKg;
  const weightDelta = profile.weightKg - startWeight;

  const restInsight = computeRestDayInsight(workoutLogs);

  return (
    <div className="space-y-6">
      {restInsight.shouldRest && <RestDayBanner consecutiveDays={restInsight.consecutiveTrainedDays} />}

      <div
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8"
        style={{ background: 'linear-gradient(120deg,#0a1120 0%,#0e7490 48%,#22d3ee 100%)' }}
      >
        {celebrating && <Confetti />}
        <div
          className="absolute -top-16 -right-10 w-56 h-56 rounded-full opacity-40 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #fbbf24, transparent 70%)' }}
        />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Welcome back, {profile.name.split(' ')[0]}
            </h1>
            <p className="text-sm text-white/80 mt-1">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            {celebrating ? (
              <p
                className="text-sm font-semibold text-amber-200 mt-3 flex items-center gap-1.5"
                style={{ animation: 'celebrate-pop 0.5s ease' }}
              >
                <Flame size={14} className="shrink-0" />
                {streaks.currentStreak}-day streak! You're on fire — keep it going.
              </p>
            ) : (
              <p className="text-sm font-medium text-white mt-3 flex items-center gap-1.5">
                <Flame size={14} className="text-amber-300 shrink-0" />
                <MotivationalTagline />
              </p>
            )}
          </div>
          <Link
            to="/profile"
            className="flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white backdrop-blur-sm transition-all shrink-0"
          >
            <Pencil size={14} /> Edit Profile
          </Link>
        </div>
      </div>

      {/* Profile summary */}
      <Card>
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <SummaryStat label="Age" value={`${profile.age}`} />
          <SummaryStat label="Height" value={formatHeight(profile.heightCm, profile.unitSystem)} />
          <SummaryStat label="Weight" value={formatWeight(profile.weightKg, profile.unitSystem)} />
          <SummaryStat label="Goal" value={GOAL_LABELS[profile.goal]} />
          {profile.targetWeightKg && (
            <SummaryStat
              label="Target"
              value={`${formatWeight(profile.targetWeightKg, profile.unitSystem)} in ${profile.timeframeWeeks}w`}
            />
          )}
        </div>
        {profile.expectations && (
          <p className="text-sm mt-3 pt-3 border-t border-gray-100 dark:border-slate-800" style={{ color: 'var(--text-secondary)' }}>
            <Target size={14} className="inline mr-1.5 -mt-0.5" />
            {profile.expectations}
          </p>
        )}
      </Card>

      <QuickLogCard />

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatTile icon={Flame} label="Calories Left Today" value={<CountUp value={Math.max(0, Math.round(targets.calories - consumed.calories + caloriesBurnedToday))} />} sub={`of ${targets.calories} kcal`} accent="var(--series-1)" />
        <StatTile icon={Clock} label="Workout Time Today" value={<CountUp value={workoutMinutesToday} suffix=" min" />} sub={todaysWorkouts.map((w) => w.workoutName).join(', ') || 'No workout logged yet'} accent="var(--series-3)" />
        <StatTile icon={TrendingUp} label="This Week" value={<CountUp value={weeklyMinutes} suffix=" min" />} sub="total training time" accent="var(--series-2)" />
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
          accent="var(--series-4)"
        />
        <StatTile icon={Zap} label="Current Streak" value={<CountUp value={streaks.currentStreak} suffix="d" />} sub="days logged in a row" accent="var(--brand-lime)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
      </div>

      <Card title="Micronutrients Today">
        {todaysFood.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No food logged yet today. <Link to="/nutrition" className="text-cyan-600 dark:text-cyan-400 underline">Log a meal</Link> to see your micronutrient breakdown.
          </p>
        ) : (
          <MicronutrientList totals={microTotals} />
        )}
      </Card>

      <Link
        to="/progress"
        className="flex items-center justify-between p-4 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-cyan-400 hover:-translate-y-0.5 active:scale-[0.99] transition-all"
      >
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          View weight trend, strength gains & progress photos
        </span>
        <span className="text-sm font-medium text-cyan-600 dark:text-cyan-400">Progress →</span>
      </Link>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}
