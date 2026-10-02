import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { CalendarCheck, Check, ChevronRight, Dumbbell, PlayCircle, Sparkles } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';
import type { Exercise, UnitSystem, WeekDay } from '@fittrack/shared';
import {
  PLAN_TEMPLATES,
  colors,
  displayWeight,
  findExercise,
  isCustomised,
  isDeloadActive,
  planWeekNumber,
  recommendPlan,
  todayISO,
  weekOverview,
  weightUnitLabel,
} from '@fittrack/shared';
import Card from '@/components/ui/card';
import ExerciseVideoModal from '@/components/exercise-video-modal';
import PressableScale from '@/components/ui/pressable-scale';

const fmtLoad = (kg: number, unit: UnitSystem) => `${Math.round(displayWeight(kg, unit) * 10) / 10} ${weightUnitLabel(unit)}`;

const STATUS_LABEL: Record<WeekDay['status'], string> = {
  done: 'done',
  missed: 'missed',
  today: 'today',
  upcoming: 'coming up',
  rest: 'rest day',
};

function DayCell({ d }: { d: WeekDay }) {
  const scheduled = d.workoutName !== undefined;
  const style =
    d.status === 'done'
      ? { bg: 'rgba(34,197,94,0.16)', border: 'transparent', fg: colors.statusGood }
      : d.status === 'today'
        ? { bg: 'rgba(34,211,238,0.10)', border: colors.brandPrimary, fg: colors.brandPrimary }
        : d.status === 'missed'
          ? { bg: 'transparent', border: 'rgba(239,68,68,0.45)', fg: colors.statusCritical }
          : scheduled
            ? { bg: 'transparent', border: colors.gridline, fg: colors.textSecondary }
            : { bg: 'transparent', border: 'transparent', fg: colors.textMuted };
  return (
    <View
      className="flex-1 items-center gap-1.5"
      accessible
      accessibilityLabel={`${d.day}: ${d.workoutName ?? 'rest'}, ${STATUS_LABEL[d.status]}${d.extra ? ' (extra session)' : ''}`}
    >
      <Text className="text-[11px] font-medium" style={{ color: d.status === 'today' ? colors.brandPrimary : colors.textMuted }}>
        {d.day.slice(0, 1)}
      </Text>
      <View
        className="w-9 h-9 rounded-full items-center justify-center border"
        style={{ backgroundColor: style.bg, borderColor: style.border }}
      >
        {d.status === 'done' ? (
          <Check size={16} color={style.fg} />
        ) : scheduled ? (
          <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: style.fg }} />
        ) : (
          <Text style={{ color: style.fg }}>·</Text>
        )}
      </View>
    </View>
  );
}

/**
 * The plan the user is on: which week, what's done, what's next.
 *
 * Until now this tab was a catalogue — the same six templates whether you'd followed one for a
 * month or never opened it, with no sign the app knew you were on any of them. Most of the
 * information was already there (the schedule, the logs); it just was never put together.
 */
function YourPlanCard() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile)!;
  const schedule = useAppStore((s) => s.scheduledWorkouts);
  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const today = todayISO();

  const template = profile.activePlan ? PLAN_TEMPLATES.find((t) => t.id === profile.activePlan!.templateId) : undefined;
  const week = useMemo(() => weekOverview(schedule, workoutLogs, today), [schedule, workoutLogs, today]);
  const weekNumber = profile.activePlan && template ? planWeekNumber(profile.activePlan.startedOn, today) : null;
  const customised = template ? isCustomised(template, schedule) : false;

  const nextWhen = week.next
    ? week.next.date === today
      ? 'today'
      : new Date(`${week.next.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' })
    : null;

  return (
    <Card>
      <View className="flex-row items-start justify-between gap-3 mb-1">
        <View className="flex-1 min-w-0">
          <Text className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: colors.textMuted }}>
            Your plan
          </Text>
          <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>
            {template ? template.name : 'Your weekly schedule'}
          </Text>
          <Text className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
            {/* The split only when the name doesn't already say it ("Push / Pull / Legs" is both). */}
            {template && customised ? `Based on ${template.name} · ` : ''}
            {template && !customised && !template.name.startsWith(template.split) ? `${template.split} · ` : ''}
            {week.planned} sessions a week
          </Text>
        </View>
        {weekNumber !== null && (
          <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(34,211,238,0.12)' }}>
            <Text className="text-xs font-semibold" style={{ color: colors.brandPrimary }}>
              Week {weekNumber}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row mt-4 mb-4">
        {week.days.map((d) => (
          <DayCell key={d.day} d={d} />
        ))}
      </View>

      <Text className="text-sm" style={{ color: colors.textSecondary }}>
        <Text className="font-semibold" style={{ color: colors.textPrimary }}>
          {week.done} of {week.planned}
        </Text>{' '}
        sessions done this week
        {week.extras > 0 ? ` · ${week.extras} extra` : ''}
      </Text>

      {week.next && (
        <PressableScale
          hapticStyle="selection"
          accessibilityRole="button"
          accessibilityLabel={`Next: ${week.next.workoutName}, ${nextWhen}. Open workouts`}
          onPress={() => router.push('/workouts')}
          className="flex-row items-center justify-between gap-3 mt-4 p-3.5 rounded-2xl"
          style={{ backgroundColor: colors.background }}
        >
          <View className="flex-1 min-w-0">
            <Text className="text-[11px] uppercase tracking-wide" style={{ color: colors.textMuted }}>
              Next · {nextWhen}
            </Text>
            <Text numberOfLines={1} className="text-sm font-semibold mt-0.5" style={{ color: colors.textPrimary }}>
              {week.next.workoutName}
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </PressableScale>
      )}
    </Card>
  );
}

/** Deloads planned from an insight or the player, so a plan made last week isn't invisible. */
function PlannedDeloads({ unit }: { unit: UnitSystem }) {
  const deloads = useAppStore((s) => s.deloads);
  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const cancelDeload = useAppStore((s) => s.cancelDeload);
  const active = deloads.filter((d) => isDeloadActive(d, workoutLogs));
  if (active.length === 0) return null;

  const nameOf = (id: string) =>
    findExercise(id)?.name ??
    workoutLogs.flatMap((w) => w.exerciseLogs ?? []).find((e) => e.exerciseId === id)?.exerciseName ??
    id;

  return (
    <Card title="Planned deloads">
      <View className="gap-3">
        {active.map((d) => (
          <View key={d.exerciseId} className="flex-row items-center gap-3">
            <CalendarCheck size={16} color={colors.brandLime} />
            <View className="flex-1 min-w-0">
              <Text numberOfLines={1} className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                {nameOf(d.exerciseId)}
              </Text>
              <Text className="text-xs" style={{ color: colors.textMuted }}>
                {fmtLoad(d.stalledKg, unit)} → {fmtLoad(d.deloadKg, unit)} next session
              </Text>
            </View>
            <PressableScale
              hapticStyle="selection"
              accessibilityRole="button"
              accessibilityLabel={`Cancel the deload on ${nameOf(d.exerciseId)}`}
              onPress={() => cancelDeload(d.exerciseId)}
              className="py-1"
            >
              <Text className="text-xs underline" style={{ color: colors.textMuted }}>
                Cancel
              </Text>
            </PressableScale>
          </View>
        ))}
      </View>
    </Card>
  );
}

export default function PlansScreen() {
  const profile = useAppStore((s) => s.profile)!; // gated by root layout
  const schedule = useAppStore((s) => s.scheduledWorkouts);
  const applyPlan = useAppStore((s) => s.applyPlan);
  const recommendation = recommendPlan(profile);
  const activeId = profile.activePlan?.templateId ?? null;
  const hasSchedule = schedule.length > 0;
  const [expandedId, setExpandedId] = useState<string | null>(
    hasSchedule ? null : (recommendation?.template.id ?? PLAN_TEMPLATES[0]?.id ?? null)
  );
  // Replacing a plan someone has been following resets its week count and their schedule, so it
  // takes a second tap. (RN's Alert is a no-op on web, so the confirmation lives in the button.)
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [videoExercise, setVideoExercise] = useState<Exercise | null>(null);
  const activeName = PLAN_TEMPLATES.find((t) => t.id === activeId)?.name;

  function onApply(templateId: string) {
    const template = PLAN_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    if (hasSchedule && confirmId !== templateId) {
      setConfirmId(templateId);
      return;
    }
    applyPlan(template);
    setConfirmId(null);
    setExpandedId(null);
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }} edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 16, gap: 16 }}>
        <View>
          <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
            Plans
          </Text>
          <Text className="text-sm" style={{ color: colors.textSecondary }}>
            {hasSchedule
              ? 'Where you are this week, and what comes next.'
              : 'Proven training splits — pick one and apply it to your weekly schedule in one tap.'}
          </Text>
        </View>

        {hasSchedule && <YourPlanCard />}
        <PlannedDeloads unit={profile.unitSystem} />

        <View className="mt-2">
          <Text className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: colors.textMuted }}>
            {hasSchedule ? 'Browse plans' : 'Workout plan ideas'}
          </Text>

          {recommendation && recommendation.template.id !== activeId && (
            <View
              className="flex-row items-start gap-3 p-4 rounded-2xl border mb-4"
              style={{ backgroundColor: 'rgba(34,211,238,0.08)', borderColor: colors.brandPrimary }}
            >
              <Sparkles size={18} color={colors.brandPrimary} style={{ marginTop: 2 }} />
              <View className="flex-1">
                <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                  Recommended for you: {recommendation.template.name}
                </Text>
                <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                  {recommendation.reason}
                </Text>
              </View>
            </View>
          )}

          <View style={{ gap: 16 }}>
            {PLAN_TEMPLATES.map((t) => {
              const isOpen = expandedId === t.id;
              const isActive = activeId === t.id;
              const isRecommended = recommendation?.template.id === t.id;
              const confirming = confirmId === t.id;
              return (
                <Card key={t.id} className="!p-0">
                  <PressableScale
                    hapticStyle="selection"
                    onPress={() => {
                      setExpandedId(isOpen ? null : t.id);
                      setConfirmId(null);
                    }}
                    className="flex-row items-center justify-between gap-4 p-5"
                  >
                    <View className="flex-row items-center gap-3 flex-1 min-w-0">
                      <View
                        className="w-10 h-10 rounded-xl items-center justify-center"
                        style={{ backgroundColor: 'rgba(34,211,238,0.12)' }}
                      >
                        <Dumbbell size={18} color={colors.brandPrimary} />
                      </View>
                      <View className="flex-1 min-w-0">
                        <View className="flex-row items-center gap-1.5 flex-wrap">
                          <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                            {t.name}
                          </Text>
                          {isRecommended && !isActive && (
                            <View className="px-1.5 py-0.5 rounded-full" style={{ backgroundColor: colors.brandPrimaryDark }}>
                              <Text className="text-[10px] font-semibold uppercase tracking-wide text-white">Recommended</Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-xs" style={{ color: colors.textMuted }}>
                          {t.split} · {t.daysPerWeek} days/week
                        </Text>
                      </View>
                    </View>
                    {isActive && (
                      <View className="flex-row items-center gap-1">
                        <Check size={14} color={colors.brandPrimary} />
                        <Text className="text-xs font-medium" style={{ color: colors.brandPrimary }}>
                          Current
                        </Text>
                      </View>
                    )}
                  </PressableScale>

                  {isOpen && (
                    <View className="px-5 pb-5 pt-4 border-t" style={{ borderColor: colors.gridline }}>
                      <Text className="text-sm mb-4" style={{ color: colors.textSecondary }}>
                        {t.description}
                      </Text>
                      <View style={{ gap: 12 }} className="mb-4">
                        {t.days.map((d) => (
                          <View key={d.label} className="rounded-xl p-3" style={{ backgroundColor: colors.background }}>
                            <Text className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: colors.textMuted }}>
                              {d.label} · {d.focus}
                            </Text>
                            <View style={{ gap: 4 }}>
                              {d.exercises.map((ex) => (
                                <View key={ex.id} className="flex-row items-center justify-between">
                                  <Text className="text-sm flex-1 mr-2" style={{ color: colors.textPrimary }}>
                                    {ex.name}
                                  </Text>
                                  <PressableScale accessibilityLabel={`Watch ${ex.name} demo`} accessibilityRole="button" onPress={() => setVideoExercise(ex)}>
                                    <PlayCircle size={15} color={colors.brandPrimary} />
                                  </PressableScale>
                                </View>
                              ))}
                            </View>
                          </View>
                        ))}
                      </View>

                      {confirming && (
                        <Text className="text-xs mb-2" style={{ color: colors.statusWarning }}>
                          {isActive
                            ? `This restarts ${t.name} from week 1 and resets your schedule.`
                            : `This replaces your current ${activeName ? activeName : 'schedule'} and starts ${t.name} from week 1.`}
                        </Text>
                      )}
                      <View className="flex-row gap-2 flex-wrap items-center">
                        <PressableScale
                          hapticStyle={confirming ? 'warning' : 'success'}
                          accessibilityRole="button"
                          onPress={() => onApply(t.id)}
                          className="px-4 py-2 rounded-full"
                          style={{ backgroundColor: confirming ? colors.brandLimeDark : colors.brandPrimaryDark }}
                        >
                          <Text className="text-sm font-semibold text-white">
                            {confirming
                              ? isActive
                                ? 'Restart plan'
                                : `Switch to ${t.name}`
                              : isActive
                                ? 'Restart this plan'
                                : hasSchedule
                                  ? 'Use this plan'
                                  : 'Apply to weekly schedule'}
                          </Text>
                        </PressableScale>
                        {confirming && (
                          <PressableScale hapticStyle="selection" accessibilityRole="button" onPress={() => setConfirmId(null)} className="px-2 py-2">
                            <Text className="text-sm" style={{ color: colors.textMuted }}>
                              Keep current
                            </Text>
                          </PressableScale>
                        )}
                      </View>
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {videoExercise && <ExerciseVideoModal exercise={videoExercise} onClose={() => setVideoExercise(null)} />}
    </SafeAreaView>
  );
}
