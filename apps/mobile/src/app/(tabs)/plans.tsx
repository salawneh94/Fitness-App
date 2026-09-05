import { useState } from 'react';
import { useRouter } from 'expo-router';
import { CheckCircle2, Dumbbell, PlayCircle, Sparkles } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';
import type { Exercise } from '@fittrack/shared';
import { PLAN_TEMPLATES, colors, recommendPlan } from '@fittrack/shared';
import Card from '@/components/ui/card';
import ExerciseVideoModal from '@/components/exercise-video-modal';
import PressableScale from '@/components/ui/pressable-scale';
import { buildScheduledWorkouts } from '@/lib/apply-plan';

export default function PlansScreen() {
  const profile = useAppStore((s) => s.profile)!; // gated by root layout
  const setScheduledWorkouts = useAppStore((s) => s.setScheduledWorkouts);
  const recommendation = recommendPlan(profile);
  const [expandedId, setExpandedId] = useState<string | null>(recommendation?.template.id ?? PLAN_TEMPLATES[0]?.id ?? null);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [videoExercise, setVideoExercise] = useState<Exercise | null>(null);
  const router = useRouter();

  function applyPlan(templateId: string) {
    const template = PLAN_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setScheduledWorkouts(buildScheduledWorkouts(template));
    setAppliedId(templateId);
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }} edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 16, gap: 16 }}>
        <View>
          <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
            Workout Plan Ideas
          </Text>
          <Text className="text-sm" style={{ color: colors.textSecondary }}>
            Proven training splits — pick one and apply it to your weekly schedule in one tap.
          </Text>
        </View>

        {recommendation && (
          <View
            className="flex-row items-start gap-3 p-4 rounded-2xl border"
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
            const isApplied = appliedId === t.id;
            const isRecommended = recommendation?.template.id === t.id;
            return (
              <Card key={t.id} className={isRecommended ? '!p-0' : '!p-0'}>
                <PressableScale hapticStyle="selection" onPress={() => setExpandedId(isOpen ? null : t.id)} className="flex-row items-center justify-between gap-4 p-5">
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
                        {isRecommended && (
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
                  {isApplied && (
                    <View className="flex-row items-center gap-1">
                      <CheckCircle2 size={14} color={colors.brandPrimary} />
                      <Text className="text-xs font-medium" style={{ color: colors.brandPrimary }}>
                        Applied
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
                                <PressableScale onPress={() => setVideoExercise(ex)}>
                                  <PlayCircle size={15} color={colors.brandPrimary} />
                                </PressableScale>
                              </View>
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                    <View className="flex-row gap-2 flex-wrap">
                      <PressableScale hapticStyle="success"
                        onPress={() => applyPlan(t.id)}
                        className="px-4 py-2 rounded-full"
                        style={{ backgroundColor: colors.brandPrimaryDark }}
                      >
                        <Text className="text-sm font-semibold text-white">Apply to weekly schedule</Text>
                      </PressableScale>
                      {isApplied && (
                        <PressableScale
                          onPress={() => router.push('/workouts')}
                          className="px-4 py-2 rounded-lg border"
                          style={{ borderColor: colors.gridline }}
                        >
                          <Text className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                            View schedule
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
      </ScrollView>

      {videoExercise && <ExerciseVideoModal exercise={videoExercise} onClose={() => setVideoExercise(null)} />}
    </SafeAreaView>
  );
}
