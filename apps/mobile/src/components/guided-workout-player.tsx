import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Pause, Play, PlayCircle, Plus, SkipForward, X } from 'lucide-react-native';
import { Modal, Text, View } from 'react-native';
import type { ExerciseLogEntry, ScheduledWorkout, UnitSystem } from '@fittrack/shared';
import { displayWeight, toKgFromDisplay, weightUnitLabel } from '@fittrack/shared';
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

  const exercise = workout.exercises[exerciseIndex];
  const isLast = exerciseIndex === workout.exercises.length - 1;

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

  function logSet() {
    if (draftWeight === '' && draftReps === '') return;
    const weightKg = draftWeight === '' ? 0 : toKgFromDisplay(Number(draftWeight), unit);
    const reps = draftReps === '' ? 0 : Number(draftReps);
    setSetsByExercise((prev) => ({
      ...prev,
      [exercise.id]: [...(prev[exercise.id] ?? []), { weightKg, reps }],
    }));
    setDraftWeight('');
    setDraftReps('');
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
      setExerciseIndex((i) => Math.min(workout.exercises.length - 1, i + 1));
    }
  }

  function goPrev() {
    setResting(false);
    setRestSeconds(null);
    setExerciseIndex((i) => Math.max(0, i - 1));
  }

  const setsForExercise = setsByExercise[exercise.id] ?? [];

  if (showFinish) {
    return (
      <FinishScreen
        durationMin={Math.max(1, Math.round(elapsedSec / 60))}
        setsByExercise={setsByExercise}
        workout={workout}
        onSave={(caloriesBurned, notes) => {
          const exerciseLogs: ExerciseLogEntry[] = workout.exercises
            .filter((ex) => (setsByExercise[ex.id] ?? []).length > 0)
            .map((ex) => ({ exerciseId: ex.id, exerciseName: ex.name, sets: setsByExercise[ex.id] }));
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
            Exercise {exerciseIndex + 1} / {workout.exercises.length}
          </Text>
          <Text className="text-sm font-medium text-white/70">{formatClock(elapsedSec)}</Text>
        </View>

        <View className="px-4 mb-2">
          <View className="h-1 rounded-full overflow-hidden bg-white/10">
            <View
              className="h-full bg-cyan-500"
              style={{ width: `${((exerciseIndex + 1) / workout.exercises.length) * 100}%` }}
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
              <PressableScale onPress={() => setShowVideo(true)} className="flex-row items-center gap-1.5 mb-8">
                <PlayCircle size={16} color={'#22d3ee'} />
                <Text className="text-sm" style={{ color: '#22d3ee' }}>
                  Watch demo
                </Text>
              </PressableScale>
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
  onSave,
  onBack,
}: {
  durationMin: number;
  setsByExercise: Record<string, { weightKg: number; reps: number }[]>;
  workout: ScheduledWorkout;
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
