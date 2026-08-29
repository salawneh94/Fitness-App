import { useEffect, useRef, useState } from 'react';
import { X, Play, Pause, SkipForward, ChevronLeft, ChevronRight, PlayCircle, Plus, Check } from 'lucide-react';
import type { ExerciseLogEntry, ScheduledWorkout, UnitSystem } from '../types';
import { displayWeight, toKgFromDisplay, weightUnitLabel } from '../lib/units';
import ExerciseVideoModal from './ExerciseVideoModal';
import Confetti from './Confetti';

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

  const [draftWeight, setDraftWeight] = useState<number | ''>('');
  const [draftReps, setDraftReps] = useState<number | ''>('');
  const [showVideo, setShowVideo] = useState(false);

  const exercise = workout.exercises[exerciseIndex];
  const isLast = exerciseIndex === workout.exercises.length - 1;

  // Overall session clock
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsedSec(Math.round((Date.now() - startedAtRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Rest countdown
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
    setSetsByExercise((prev) => ({
      ...prev,
      [exercise.id]: [...(prev[exercise.id] ?? []), { weightKg: draftWeight === '' ? 0 : draftWeight, reps: draftReps === '' ? 0 : draftReps }],
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
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-4">
        <button onClick={onCancel} className="p-2 -ml-2 rounded-full hover:bg-white/10" aria-label="Cancel workout">
          <X size={20} />
        </button>
        <span className="text-sm font-medium text-white/70">
          Exercise {exerciseIndex + 1} / {workout.exercises.length}
        </span>
        <span className="text-sm font-medium tabular-nums text-white/70">{formatClock(elapsedSec)}</span>
      </div>

      <div className="px-4 mb-2">
        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-cyan-500 transition-all"
            style={{ width: `${((exerciseIndex + 1) / workout.exercises.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        {resting ? (
          <>
            <p className="text-sm uppercase tracking-wide text-white/50 mb-3">Rest</p>
            <p className="text-6xl font-bold tabular-nums mb-6">{formatClock(restSeconds ?? 0)}</p>
            <div className="flex gap-2 mb-8">
              {REST_PRESETS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setRestSeconds(s);
                    setRestDuration(s);
                  }}
                  className="px-3 py-1.5 rounded-full border border-white/20 text-xs text-white/70"
                >
                  {s}s
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setRunning((r) => !r)}
                className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
                aria-label={running ? 'Pause' : 'Resume'}
              >
                {running ? <Pause size={22} /> : <Play size={22} />}
              </button>
              <button
                onClick={() => setResting(false)}
                className="w-14 h-14 rounded-full bg-cyan-600 flex items-center justify-center active:scale-90 transition-transform"
                aria-label="Skip rest"
              >
                <SkipForward size={22} />
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs uppercase tracking-wide text-white/50 mb-2">{exercise.equipment}</p>
            <h1 className="text-3xl font-bold mb-3">{exercise.name}</h1>
            <p className="text-white/60 mb-6">
              {exercise.sets && exercise.reps ? `${exercise.sets} sets × ${exercise.reps}` : exercise.notes ?? 'Log your sets below'}
            </p>
            <button
              onClick={() => setShowVideo(true)}
              className="flex items-center gap-1.5 text-sm text-cyan-400 mb-8"
            >
              <PlayCircle size={16} /> Watch demo
            </button>
            {showVideo && <ExerciseVideoModal exercise={exercise} onClose={() => setShowVideo(false)} />}

            {setsForExercise.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {setsForExercise.map((s, i) => (
                  <span key={i} className="flex items-center gap-1 text-xs bg-white/10 rounded-full px-3 py-1.5">
                    <Check size={12} className="text-cyan-400" />
                    {Math.round(displayWeight(s.weightKg, unit) * 10) / 10} {weightUnitLabel(unit)} × {s.reps}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 mb-2">
              <input
                type="number"
                min={0}
                step={0.5}
                placeholder={weightUnitLabel(unit)}
                className="w-24 rounded-xl bg-white/10 border border-white/20 px-3 py-2.5 text-center text-white placeholder-white/30"
                value={draftWeight}
                onChange={(e) => setDraftWeight(e.target.value === '' ? '' : toKgFromDisplay(Number(e.target.value), unit))}
              />
              <span className="text-white/40 text-sm">×</span>
              <input
                type="number"
                min={0}
                placeholder="reps"
                className="w-24 rounded-xl bg-white/10 border border-white/20 px-3 py-2.5 text-center text-white placeholder-white/30"
                value={draftReps}
                onChange={(e) => setDraftReps(e.target.value === '' ? '' : Number(e.target.value))}
              />
              <button
                onClick={logSet}
                className="w-11 h-11 rounded-full bg-cyan-600 flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                aria-label="Log set"
              >
                <Plus size={20} />
              </button>
            </div>
          </>
        )}
      </div>

      <div
        className="flex items-center justify-between px-6 pt-6 gap-3"
        style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
      >
        <button
          onClick={goPrev}
          disabled={exerciseIndex === 0}
          className="flex items-center gap-1 px-4 py-3 rounded-full border border-white/20 text-sm font-medium disabled:opacity-30"
        >
          <ChevronLeft size={16} /> Prev
        </button>
        <button
          onClick={goNext}
          className="flex-1 flex items-center justify-center gap-1 px-4 py-3 rounded-full bg-cyan-600 hover:bg-cyan-700 active:scale-95 transition-transform text-sm font-semibold"
        >
          {isLast ? 'Finish Workout' : 'Next Exercise'} <ChevronRight size={16} />
        </button>
      </div>
    </div>
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
  const [caloriesBurned, setCaloriesBurned] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const totalSets = Object.values(setsByExercise).reduce((s, sets) => s + sets.length, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col items-center justify-center px-6">
      <Confetti />
      <p className="text-sm uppercase tracking-wide text-white/50 mb-2">Workout complete</p>
      <h1 className="text-3xl font-bold mb-6 text-center" style={{ animation: 'celebrate-pop 0.5s ease' }}>
        Nice work on {workout.name}!
      </h1>
      <div className="flex gap-6 mb-8">
        <div className="text-center">
          <p className="text-2xl font-bold">{durationMin}</p>
          <p className="text-xs text-white/50">minutes</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">{totalSets}</p>
          <p className="text-xs text-white/50">sets logged</p>
        </div>
      </div>
      <div className="w-full max-w-xs space-y-3 mb-6">
        <input
          type="number"
          min={0}
          placeholder="Calories burned (optional)"
          className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-white/40"
          value={caloriesBurned}
          onChange={(e) => setCaloriesBurned(e.target.value === '' ? '' : Number(e.target.value))}
        />
        <textarea
          rows={2}
          placeholder="Notes (optional)"
          className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-white/40"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <div className="w-full max-w-xs flex gap-2">
        <button onClick={onBack} className="flex-1 py-3 rounded-full border border-white/20 text-sm font-medium">
          Back
        </button>
        <button
          onClick={() => onSave(caloriesBurned === '' ? undefined : caloriesBurned, notes || undefined)}
          className="flex-1 py-3 rounded-full bg-cyan-600 hover:bg-cyan-700 active:scale-95 transition-transform text-sm font-semibold"
        >
          Save
        </button>
      </div>
    </div>
  );
}
