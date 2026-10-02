import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Pause, Play, PlayCircle, Plus, Repeat, SkipForward, Trophy, X } from 'lucide-react-native';
import { Modal, ScrollView, Text, View } from 'react-native';
import type { Exercise, ExerciseLogEntry, PersonalRecord, ScheduledWorkout, UnitSystem } from '@fittrack/shared';
import { colors, displayWeight, toKgFromDisplay, weightUnitLabel } from '@fittrack/shared';
import {
  EXERCISE_LIBRARY,
  deloadWeight,
  findPersonalRecords,
  lastPerformance,
  parseRepRange,
  suggestNextLoad,
  swapCandidates,
} from '@fittrack/shared';
import { useAppStore } from '@/store/useAppStore';
import ExerciseVideoModal from './exercise-video-modal';
import Confetti from './confetti';
import TextField from './ui/text-field';
import PressableScale from '@/components/ui/pressable-scale';

const REST_PRESETS = [30, 60, 90, 120, 180];

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function GuidedWorkoutPlayer({
  workout,
  unit,
  onFinish,
  onCancel,
}: {
  workout: ScheduledWorkout;
  unit: UnitSystem;
  onFinish: (durationMin: number, exerciseLogs: ExerciseLogEntry[], caloriesBurned: number | undefined, notes: string | undefined) => void;
  onCancel: () => void;
}) {
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setsByExercise, setSetsByExercise] = useState<Record<string, { weightKg: number; reps: number }[]>>({});
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  const [restDuration, setRestDuration] = useState(90);
  const [resting, setResting] = useState(false);
  const [running, setRunning] = useState(true);
  const [showFinish, setShowFinish] = useState(false);

  const startedAtRef = useRef(Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);

  const [draftWeight, setDraftWeight] = useState('');
  const [draftReps, setDraftReps] = useState('');
  const [showVideo, setShowVideo] = useState(false);

  // The session's own copy, so an exercise can be swapped for today without touching the plan.
  const [exercises, setExercises] = useState<Exercise[]>(workout.exercises);
  const [swapping, setSwapping] = useState(false);
  const [swapChoice, setSwapChoice] = useState<Exercise | null>(null);
  const exercise = exercises[exerciseIndex];
  const isLast = exerciseIndex === exercises.length - 1;

  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const deload = useAppStore((s) => s.deloads.find((d) => d.exerciseId === exercise.id));
  const startDeload = useAppStore((s) => s.startDeload);
  const suggestion = useMemo(() => {
    const previous = lastPerformance(workoutLogs, exercise.id);
    return previous ? suggestNextLoad(previous, exercise, workoutLogs, deload) : null;
  }, [workoutLogs, exercise, deload]);

  // Where the player has been saying "if it stalls again, try dropping 10%", it can now just do it.
  const offerDeload =
    suggestion?.action === 'add_reps' && suggestion.sessionsAtWeight >= 3
      ? deloadWeight(suggestion.previous.weightKg, exercise.equipment)
      : null;

  function deloadNow(deloadKg: number) {
    if (!suggestion) return;
    startDeload({ exerciseId: exercise.id, stalledKg: suggestion.previous.weightKg, deloadKg });
    // The prefill only runs when the exercise changes, so a plan made mid-screen fills the fields
    // itself — otherwise the button would change the advice but leave the old numbers in the boxes.
    setDraftWeight(String(fmt(deloadKg)));
    const range = parseRepRange(exercise.reps);
    if (range) setDraftReps(String(range.max));
  }

  /** Weights are stored in kg; the player shows whatever unit the user picked. */
  const fmt = (kg: number) => Math.round(displayWeight(kg, unit) * 10) / 10;

  const setsForExercise = setsByExercise[exercise.id] ?? [];

  // Telling someone to try 72.5kg for 6 and then handing them an empty box is most of the work
  // with none of the payoff. The fields start on the suggestion, so accepting it is one tap on
  // the log button and changing it is the same typing it always was.
  //
  // Only for the first set of an exercise: once they've logged one, logSet carries their actual
  // numbers forward instead, because set two is nearly always the same weight as set one rather
  // than whatever was suggested before the session started.
  useEffect(() => {
    if (setsForExercise.length > 0) return;
    if (!suggestion) {
      setDraftWeight('');
      setDraftReps('');
      return;
    }
    setDraftWeight(suggestion.weightKg > 0 ? String(fmt(suggestion.weightKg)) : '');
    setDraftReps(String(suggestion.targetReps));
    // Keyed on the exercise, not on `suggestion`: re-running whenever the memo re-computes would
    // overwrite whatever the user had started typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsedSec(Math.round((Date.now() - startedAtRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!resting || restSeconds === null || !running) return;
    if (restSeconds <= 0) {
      setResting(false);
      return;
    }
    const id = setTimeout(() => setRestSeconds((s) => (s !== null ? s - 1 : s)), 1000);
    return () => clearTimeout(id);
  }, [resting, restSeconds, running]);

  // Same muscles, same kind of work; nothing already in today's session (two entries with one id
  // would share their logged sets).
  const alternatives = useMemo(() => {
    const notInSession = (c: Exercise) => !exercises.some((e) => e.id === c.id);
    const { close, other } = swapCandidates(exercise, EXERCISE_LIBRARY);
    return { close: close.filter(notInSession), other: other.filter(notInSession) };
  }, [exercise, exercises]);
  const hasAlternatives = alternatives.close.length + alternatives.other.length > 0;

  /**
   * Put another exercise in this slot — for today, or in the plan too.
   *
   * The gym being out of a bench used to mean skipping the exercise or abandoning the plan. The
   * slot keeps the plan's set count, but takes the new exercise's own rep range: 8–12 on a cable
   * fly isn't 6–10 on a barbell press. The next-load suggestion then comes from the new
   * exercise's own history, since the prefill re-runs on the exercise changing.
   */
  function applySwap(alt: Exercise, inPlan: boolean) {
    const original = exercise;
    const replacement: Exercise = { ...alt, sets: original.sets ?? alt.sets };
    setExercises((prev) => prev.map((e, i) => (i === exerciseIndex ? replacement : e)));
    if (inPlan) {
      const { scheduledWorkouts, setScheduledWorkouts } = useAppStore.getState();
      setScheduledWorkouts(
        scheduledWorkouts.map((w) =>
          w.id === workout.id ? { ...w, exercises: w.exercises.map((e) => (e.id === original.id ? replacement : e)) } : w
        )
      );
    }
    setSwapping(false);
    setSwapChoice(null);
  }

  function logSet() {
    if (draftWeight === '' && draftReps === '') return;
    const weightKg = draftWeight === '' ? 0 : toKgFromDisplay(Number(draftWeight), unit);
    const reps = draftReps === '' ? 0 : Number(draftReps);
    setSetsByExercise((prev) => ({
      ...prev,
      [exercise.id]: [...(prev[exercise.id] ?? []), { weightKg, reps }],
    }));
    // The drafts are deliberately left alone rather than cleared: the next set is nearly always
    // the same weight, so emptying the fields would just ask them to retype what they entered
    // twenty seconds ago.
    setRestSeconds(restDuration);
    setResting(true);
  }

  function goNext() {
    setResting(false);
    setRestSeconds(null);
    if (isLast) {
      setRunning(false);
      setShowFinish(true);
    } else {
      setExerciseIndex((i) => Math.min(exercises.length - 1, i + 1));
    }
  }

  function goPrev() {
    setResting(false);
    setRestSeconds(null);
    setExerciseIndex((i) => Math.max(0, i - 1));
  }

  if (showFinish) {
    const exerciseLogs: ExerciseLogEntry[] = exercises
      .filter((ex) => (setsByExercise[ex.id] ?? []).length > 0)
      .map((ex) => ({ exerciseId: ex.id, exerciseName: ex.name, sets: setsByExercise[ex.id] }));
    return (
      <FinishScreen
        durationMin={Math.max(1, Math.round(elapsedSec / 60))}
        setsByExercise={setsByExercise}
        workout={workout}
        records={findPersonalRecords(exerciseLogs, workoutLogs, unit)}
        onSave={(caloriesBurned, notes) => {
          onFinish(Math.max(1, Math.round(elapsedSec / 60)), exerciseLogs, caloriesBurned, notes);
        }}
        onBack={() => setShowFinish(false)}
      />
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel}>
      <View className="flex-1 bg-black">
        <View className="flex-row items-center justify-between px-4 py-4">
          <PressableScale accessibilityLabel="Exit workout" accessibilityRole="button" onPress={onCancel} className="p-2 -ml-2">
            <X size={20} color="white" />
          </PressableScale>
          <Text className="text-sm font-medium text-white/70">
            Exercise {exerciseIndex + 1} / {exercises.length}
          </Text>
          <Text className="text-sm font-medium text-white/70">{formatClock(elapsedSec)}</Text>
        </View>

        <View className="px-4 mb-2">
          <View className="h-1 rounded-full overflow-hidden bg-white/10">
            <View
              className="h-full bg-cyan-500"
              style={{ width: `${((exerciseIndex + 1) / exercises.length) * 100}%` }}
            />
          </View>
        </View>

        <View className="flex-1 items-center justify-center px-6">
          {resting ? (
            <>
              <Text className="text-sm uppercase tracking-wide text-white/50 mb-3">Rest</Text>
              <Text className="text-6xl font-bold text-white mb-6">{formatClock(restSeconds ?? 0)}</Text>
              <View className="flex-row gap-2 mb-8">
                {REST_PRESETS.map((s) => (
                  <PressableScale
                    key={s}
                    onPress={() => {
                      setRestSeconds(s);
                      setRestDuration(s);
                    }}
                    className="px-3 py-1.5 rounded-full border border-white/20"
                  >
                    <Text className="text-xs text-white/70">{s}s</Text>
                  </PressableScale>
                ))}
              </View>
              <View className="flex-row items-center gap-4">
                <PressableScale accessibilityLabel={running ? 'Pause timer' : 'Resume timer'} accessibilityRole="button" onPress={() => setRunning((r) => !r)} className="w-14 h-14 rounded-full bg-white/10 items-center justify-center">
                  {running ? <Pause size={22} color="white" /> : <Play size={22} color="white" />}
                </PressableScale>
                <PressableScale accessibilityLabel="Skip rest" accessibilityRole="button" onPress={() => setResting(false)} className="w-14 h-14 rounded-full bg-cyan-600 items-center justify-center">
                  <SkipForward size={22} color="white" />
                </PressableScale>
              </View>
            </>
          ) : (
            <View className="items-center w-full">
              <Text className="text-xs uppercase tracking-wide text-white/50 mb-2">{exercise.equipment}</Text>
              <Text className="text-3xl font-bold text-white mb-3 text-center">{exercise.name}</Text>
              <Text className="text-white/60 mb-6 text-center">
                {exercise.sets && exercise.reps ? `${exercise.sets} sets × ${exercise.reps}` : exercise.notes ?? 'Log your sets below'}
              </Text>
              <View className="flex-row items-center gap-5 mb-8">
                <PressableScale onPress={() => setShowVideo(true)} className="flex-row items-center gap-1.5">
                  <PlayCircle size={16} color={'#22d3ee'} />
                  <Text className="text-sm" style={{ color: '#22d3ee' }}>
                    Watch demo
                  </Text>
                </PressableScale>
                {/* Only before the first set: swapping half-way through would split one
                    exercise's sets across two. */}
                {setsForExercise.length === 0 && hasAlternatives && (
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={`Swap ${exercise.name}`}
                    onPress={() => setSwapping(true)}
                    className="flex-row items-center gap-1.5"
                  >
                    <Repeat size={15} color="rgba(255,255,255,0.7)" />
                    <Text className="text-sm text-white/70">Swap exercise</Text>
                  </PressableScale>
                )}
              </View>
              {swapping && (
                <Modal visible transparent animationType="slide" onRequestClose={() => setSwapping(false)}>
                  <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <View className="rounded-t-3xl px-5 pt-5 pb-8" style={{ backgroundColor: '#111827', maxHeight: '80%' }}>
                      <Text className="text-lg font-bold text-white">Swap {exercise.name}</Text>
                      <Text className="text-xs text-white/50 mt-1 mb-4">
                        Different equipment is listed first in each group.
                      </Text>
                      <ScrollView style={{ flexGrow: 0 }}>
                        {(
                          [
                            ['Closest match — same movement', alternatives.close],
                            [`Also works your ${exercise.category.replace('_', ' ')}`, alternatives.other],
                          ] as const
                        ).map(([heading, group]) => group.length > 0 && (
                        <View key={heading} className="gap-2 mb-4">
                          <Text className="text-[11px] font-semibold uppercase tracking-wide text-white/40">{heading}</Text>
                          {group.map((alt) => {
                            const chosen = swapChoice?.id === alt.id;
                            return (
                              <PressableScale
                                key={alt.id}
                                hapticStyle="selection"
                                accessibilityRole="button"
                                accessibilityState={{ selected: chosen }}
                                onPress={() => setSwapChoice(alt)}
                                className="flex-row items-center justify-between px-4 py-3 rounded-2xl border"
                                style={{ borderColor: chosen ? '#22d3ee' : 'rgba(255,255,255,0.12)', backgroundColor: chosen ? 'rgba(34,211,238,0.10)' : 'transparent' }}
                              >
                                <View className="flex-1 min-w-0">
                                  <Text className="text-sm font-medium text-white" numberOfLines={1}>{alt.name}</Text>
                                  <Text className="text-xs text-white/50">{alt.equipment} · {alt.reps}</Text>
                                </View>
                                {chosen && <Check size={16} color="#22d3ee" />}
                              </PressableScale>
                            );
                          })}
                        </View>
                        ))}
                      </ScrollView>
                      <View className="flex-row gap-2 mt-4">
                        <PressableScale
                          disabled={!swapChoice}
                          onPress={() => swapChoice && applySwap(swapChoice, false)}
                          className="flex-1 py-3 rounded-full bg-cyan-600 items-center"
                          style={{ opacity: swapChoice ? 1 : 0.4 }}
                        >
                          <Text className="text-white text-sm font-semibold">Just today</Text>
                        </PressableScale>
                        <PressableScale
                          disabled={!swapChoice}
                          onPress={() => swapChoice && applySwap(swapChoice, true)}
                          className="flex-1 py-3 rounded-full border border-white/25 items-center"
                          style={{ opacity: swapChoice ? 1 : 0.4 }}
                        >
                          <Text className="text-white text-sm font-medium">Swap in my plan too</Text>
                        </PressableScale>
                      </View>
                      <PressableScale
                        onPress={() => {
                          setSwapping(false);
                          setSwapChoice(null);
                        }}
                        className="items-center pt-4"
                      >
                        <Text className="text-sm text-white/50">Cancel</Text>
                      </PressableScale>
                    </View>
                  </View>
                </Modal>
              )}
              {showVideo && <ExerciseVideoModal exercise={exercise} onClose={() => setShowVideo(false)} />}

              {setsForExercise.length > 0 && (
                <View className="flex-row flex-wrap justify-center gap-2 mb-6">
                  {setsForExercise.map((s, i) => (
                    <View key={i} className="flex-row items-center gap-1 bg-white/10 rounded-full px-3 py-1.5">
                      <Check size={12} color="#22d3ee" />
                      <Text className="text-xs text-white">
                        {Math.round(displayWeight(s.weightKg, unit) * 10) / 10} {weightUnitLabel(unit)} × {s.reps}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* The one question anyone has walking up to a bar. Every set, rep and kilo needed
                  to answer it was already being logged and only ever fed a chart. */}
              {suggestion && setsForExercise.length === 0 && (
                <View className="items-center mb-5 px-4">
                  <Text className="text-xs text-white/50 mb-1">
                    Last time: {fmt(suggestion.previous.weightKg)} {weightUnitLabel(unit)} ×{' '}
                    {suggestion.previous.reps.join(', ')}
                  </Text>
                  <Text className="text-sm font-semibold" style={{ color: '#22d3ee' }}>
                    {suggestion.action === 'increase_weight'
                      ? `Try ${fmt(suggestion.weightKg)} ${weightUnitLabel(unit)} × ${suggestion.targetReps}`
                      : suggestion.action === 'deload'
                        ? `Deload: ${fmt(suggestion.weightKg)} ${weightUnitLabel(unit)} × ${suggestion.targetReps}`
                        : suggestion.action === 'add_reps'
                          ? `Aim for ${suggestion.targetReps} reps at ${fmt(suggestion.weightKg)} ${weightUnitLabel(unit)}`
                          : `Hold ${suggestion.targetReps} reps — add load when you can`}
                  </Text>
                  {suggestion.action === 'deload' && (
                    <Text className="text-xs text-white/40 mt-0.5 text-center">
                      A lighter session to break the plateau — hit every rep and the weight climbs back from here
                    </Text>
                  )}
                  {suggestion.action === 'increase_weight' && (
                    <Text className="text-xs text-white/40 mt-0.5">
                      You hit the top of the range on every set
                    </Text>
                  )}
                  {suggestion.action === 'add_reps' && suggestion.sessionsAtWeight >= 3 && (
                    <View className="items-center mt-1">
                      <Text className="text-xs text-white/40 text-center">
                        {suggestion.sessionsAtWeight} sessions at this weight
                        {offerDeload !== null ? ' — a lighter session often breaks it' : ''}
                      </Text>
                      {offerDeload !== null && (
                        <PressableScale
                          hapticStyle="selection"
                          accessibilityRole="button"
                          onPress={() => deloadNow(offerDeload)}
                          className="mt-2 px-3 py-1.5 rounded-full border"
                          style={{ borderColor: 'rgba(34,211,238,0.5)' }}
                        >
                          <Text className="text-xs font-medium" style={{ color: '#22d3ee' }}>
                            Deload to {fmt(offerDeload)} {weightUnitLabel(unit)} instead
                          </Text>
                        </PressableScale>
                      )}
                    </View>
                  )}
                </View>
              )}

              <View className="flex-row items-center gap-2">
                <TextField
                  className="w-24 text-center"
                  maxFontSizeMultiplier={1.3}
                  keyboardType="numeric"
                  placeholder={weightUnitLabel(unit)}
                  value={draftWeight}
                  onChangeText={setDraftWeight}
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                />
                <Text className="text-white/40 text-sm">×</Text>
                <TextField
                  className="w-24 text-center"
                  maxFontSizeMultiplier={1.3}
                  keyboardType="numeric"
                  placeholder="reps"
                  value={draftReps}
                  onChangeText={setDraftReps}
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                />
                <PressableScale accessibilityLabel="Log set" accessibilityRole="button" hapticStyle="success" onPress={logSet} className="w-11 h-11 rounded-full bg-cyan-600 items-center justify-center">
                  <Plus size={20} color="white" />
                </PressableScale>
              </View>
            </View>
          )}
        </View>

        <View className="flex-row items-center justify-between px-6 pt-6 pb-8 gap-3">
          <PressableScale
            onPress={goPrev}
            disabled={exerciseIndex === 0}
            className="flex-row items-center gap-1 px-4 py-3 rounded-full border border-white/20"
            style={{ opacity: exerciseIndex === 0 ? 0.3 : 1 }}
          >
            <ChevronLeft size={16} color="white" />
            <Text className="text-white text-sm font-medium">Prev</Text>
          </PressableScale>
          <PressableScale onPress={goNext} className="flex-1 flex-row items-center justify-center gap-1 px-4 py-3 rounded-full bg-cyan-600">
            <Text className="text-white text-sm font-semibold">{isLast ? 'Finish Workout' : 'Next Exercise'}</Text>
            <ChevronRight size={16} color="white" />
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

function FinishScreen({
  durationMin,
  setsByExercise,
  workout,
  records,
  onSave,
  onBack,
}: {
  durationMin: number;
  setsByExercise: Record<string, { weightKg: number; reps: number }[]>;
  workout: ScheduledWorkout;
  records: PersonalRecord[];
  onSave: (caloriesBurned: number | undefined, notes: string | undefined) => void;
  onBack: () => void;
}) {
  const [caloriesBurned, setCaloriesBurned] = useState('');
  const [notes, setNotes] = useState('');
  const totalSets = Object.values(setsByExercise).reduce((s, sets) => s + sets.length, 0);

  return (
    <Modal visible animationType="slide" onRequestClose={onBack}>
      <View className="flex-1 bg-black items-center justify-center px-6">
        <Confetti />
        <Text className="text-sm uppercase tracking-wide text-white/50 mb-2">Workout complete</Text>
        <Text className="text-3xl font-bold text-white mb-6 text-center">Nice work on {workout.name}!</Text>
        <View className="flex-row gap-6 mb-8">
          <View className="items-center">
            <Text className="text-2xl font-bold text-white">{durationMin}</Text>
            <Text className="text-xs text-white/50">minutes</Text>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-white">{totalSets}</Text>
            <Text className="text-xs text-white/50">sets logged</Text>
          </View>
        </View>
        {/* The moment that makes training feel like it's working — every set needed to notice it
            was already being logged. */}
        {records.length > 0 && (
          <View className="w-full max-w-xs mb-6 rounded-2xl p-4" style={{ backgroundColor: 'rgba(251,191,36,0.10)' }}>
            <View className="flex-row items-center gap-2 mb-2">
              <Trophy size={16} color={colors.brandLime} />
              <Text className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.brandLime }}>
                {records.length === 1 ? 'New personal best' : `${records.length} new personal bests`}
              </Text>
            </View>
            <View className="gap-2">
              {records.map((r) => (
                <View key={r.exerciseId}>
                  <Text className="text-sm font-semibold text-white">{r.exerciseName}</Text>
                  <Text className="text-sm text-white/80">{r.headline}</Text>
                  <Text className="text-xs text-white/50">{r.detail}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        <View className="w-full max-w-xs gap-3 mb-6">
          <TextField
            keyboardType="numeric"
            placeholder="Calories burned (optional)"
            value={caloriesBurned}
            onChangeText={setCaloriesBurned}
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)', color: 'white' }}
          />
          <TextField
            placeholder="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)', color: 'white', height: 72, textAlignVertical: 'top' }}
          />
        </View>
        <View className="w-full max-w-xs flex-row gap-2">
          <PressableScale onPress={onBack} className="flex-1 py-3 rounded-full border border-white/20 items-center">
            <Text className="text-white text-sm font-medium">Back</Text>
          </PressableScale>
          <PressableScale hapticStyle="success"
            onPress={() => onSave(caloriesBurned === '' ? undefined : Number(caloriesBurned), notes || undefined)}
            className="flex-1 py-3 rounded-full bg-cyan-600 items-center"
          >
            <Text className="text-white text-sm font-semibold">Save</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}
