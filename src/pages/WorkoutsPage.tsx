import { lazy, Suspense, useState } from 'react';
import { PlayCircle, Plus, X, Trash2, Clock, Minus, Zap } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { Exercise, ExerciseLogEntry, ScheduledWorkout, UnitSystem, Weekday } from '../types';
import { EXERCISE_LIBRARY } from '../data/exercises';
import { todayISO } from '../lib/calc';
import { computeRestDayInsight } from '../lib/streaks';
import { displayWeight, toKgFromDisplay, weightUnitLabel } from '../lib/units';
import Card from '../components/ui/Card';
import RestDayBanner from '../components/RestDayBanner';

const GuidedWorkoutPlayer = lazy(() => import('../components/GuidedWorkoutPlayer'));

const WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export default function WorkoutsPage() {
  const profile = useAppStore((s) => s.profile);
  const scheduledWorkouts = useAppStore((s) => s.scheduledWorkouts);
  const setScheduledWorkouts = useAppStore((s) => s.setScheduledWorkouts);
  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const addWorkoutLog = useAppStore((s) => s.addWorkoutLog);
  const removeWorkoutLog = useAppStore((s) => s.removeWorkoutLog);

  const [activeDay, setActiveDay] = useState<Weekday | null>(null);
  const [editingDay, setEditingDay] = useState<Weekday | null>(null);
  const [loggingDay, setLoggingDay] = useState<ScheduledWorkout | null>(null);
  const [playingWorkout, setPlayingWorkout] = useState<ScheduledWorkout | null>(null);

  const workoutForDay = (day: Weekday) => scheduledWorkouts.find((w) => w.day === day);
  const restInsight = computeRestDayInsight(workoutLogs);

  function saveDayWorkout(day: Weekday, name: string, exerciseIds: string[]) {
    const exercises = EXERCISE_LIBRARY.filter((e) => exerciseIds.includes(e.id));
    const others = scheduledWorkouts.filter((w) => w.day !== day);
    if (name.trim() && exercises.length > 0) {
      setScheduledWorkouts([...others, { id: uid(), day, name: name.trim(), exercises }]);
    } else {
      setScheduledWorkouts(others);
    }
    setEditingDay(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Workout Tracker</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Your weekly schedule — tap a day to see exercises & video demos.</p>
      </div>

      {restInsight.shouldRest && <RestDayBanner consecutiveDays={restInsight.consecutiveTrainedDays} />}

      <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
        {WEEKDAYS.map((day) => {
          const w = workoutForDay(day);
          const isToday = new Date().toLocaleDateString('en-US', { weekday: 'short' }) === day;
          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={`rounded-2xl border p-3 text-left transition-colors ${
                isToday ? 'border-orange-400 bg-orange-50/60 dark:bg-orange-950/30' : 'border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
              } hover:border-orange-400`}
            >
              <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{day}</p>
              <p className="text-sm font-medium mt-1 line-clamp-2 min-h-[2.5rem]" style={{ color: w ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {w ? w.name : 'Rest'}
              </p>
              {w && <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{w.exercises.length} exercises</p>}
            </button>
          );
        })}
      </div>

      {activeDay && (
        <DayDetailModal
          day={activeDay}
          workout={workoutForDay(activeDay)}
          onClose={() => setActiveDay(null)}
          onEdit={() => {
            setEditingDay(activeDay);
            setActiveDay(null);
          }}
          onLog={(w) => {
            setLoggingDay(w);
            setActiveDay(null);
          }}
          onPlay={(w) => {
            setPlayingWorkout(w);
            setActiveDay(null);
          }}
        />
      )}

      {editingDay && (
        <EditDayModal
          day={editingDay}
          existing={workoutForDay(editingDay)}
          onClose={() => setEditingDay(null)}
          onSave={(name, ids) => saveDayWorkout(editingDay, name, ids)}
        />
      )}

      {loggingDay && (
        <LogWorkoutModal
          workout={loggingDay}
          unit={profile?.unitSystem ?? 'metric'}
          onClose={() => setLoggingDay(null)}
          onSave={(durationMin, caloriesBurned, notes, exerciseLogs) => {
            addWorkoutLog({ date: todayISO(), workoutName: loggingDay.name, durationMin, caloriesBurned, notes, exerciseLogs });
            setLoggingDay(null);
          }}
        />
      )}

      {playingWorkout && (
        <Suspense fallback={<div className="fixed inset-0 z-50 bg-black" />}>
          <GuidedWorkoutPlayer
            workout={playingWorkout}
            unit={profile?.unitSystem ?? 'metric'}
            onCancel={() => setPlayingWorkout(null)}
            onFinish={(durationMin, exerciseLogs, caloriesBurned, notes) => {
              addWorkoutLog({ date: todayISO(), workoutName: playingWorkout.name, durationMin, caloriesBurned, notes, exerciseLogs });
              setPlayingWorkout(null);
            }}
          />
        </Suspense>
      )}

      <Card title="Recent Activity">
        {workoutLogs.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No workouts logged yet. Complete a session and log it to build your history.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
            {[...workoutLogs].reverse().slice(0, 10).map((log) => (
              <li key={log.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{log.workoutName}</p>
                  <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <Clock size={12} /> {log.durationMin} min · {new Date(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    {log.caloriesBurned ? ` · ${log.caloriesBurned} kcal` : ''}
                    {log.exerciseLogs && log.exerciseLogs.length > 0
                      ? ` · ${log.exerciseLogs.reduce((s, e) => s + e.sets.length, 0)} sets logged`
                      : ''}
                  </p>
                </div>
                <button onClick={() => removeWorkoutLog(log.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40">
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function DayDetailModal({
  day,
  workout,
  onClose,
  onEdit,
  onLog,
  onPlay,
}: {
  day: Weekday;
  workout?: ScheduledWorkout;
  onClose: () => void;
  onEdit: () => void;
  onLog: (w: ScheduledWorkout) => void;
  onPlay: (w: ScheduledWorkout) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{day} — {workout?.name ?? 'Rest Day'}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {workout ? (
          <>
            <ul className="space-y-2 mb-4">
              {workout.exercises.map((ex) => (
                <li key={ex.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 dark:bg-neutral-800">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{ex.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {ex.equipment} {ex.sets && ex.reps ? `· ${ex.sets} × ${ex.reps}` : ex.notes ? `· ${ex.notes}` : ''}
                    </p>
                  </div>
                  <a
                    href={ex.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400 shrink-0"
                  >
                    <PlayCircle size={16} /> Demo
                  </a>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button onClick={onEdit} className="py-2.5 px-4 rounded-lg border border-gray-300 dark:border-neutral-700 text-sm font-medium">
                Edit
              </button>
              <button onClick={() => onLog(workout)} className="flex-1 py-2.5 rounded-full border border-orange-600 text-orange-600 dark:text-orange-400 text-sm font-semibold">
                Log as done
              </button>
              <button
                onClick={() => onPlay(workout)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold"
              >
                <Zap size={15} /> Start Workout
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No workout scheduled for this day.</p>
            <button onClick={onEdit} className="inline-flex items-center gap-1.5 py-2.5 px-4 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold">
              <Plus size={16} /> Add a workout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EditDayModal({
  day,
  existing,
  onClose,
  onSave,
}: {
  day: Weekday;
  existing?: ScheduledWorkout;
  onClose: () => void;
  onSave: (name: string, exerciseIds: string[]) => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [selected, setSelected] = useState<string[]>(existing?.exercises.map((e) => e.id) ?? []);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const categories = Array.from(new Set(EXERCISE_LIBRARY.map((e) => e.category)));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Edit {day}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <label className="block mb-4">
          <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Workout name</span>
          <input
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Push Day"
          />
        </label>

        <div className="space-y-4 mb-4">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>{cat.replace('_', ' ')}</p>
              <div className="flex flex-wrap gap-1.5">
                {EXERCISE_LIBRARY.filter((e) => e.category === cat).map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => toggle(ex.id)}
                    className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                      selected.includes(ex.id)
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {ex.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-neutral-700 text-sm font-medium">
            Cancel
          </button>
          <button
            onClick={() => onSave(name, selected)}
            className="flex-1 py-2.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function LogWorkoutModal({
  workout,
  unit,
  onClose,
  onSave,
}: {
  workout: ScheduledWorkout;
  unit: UnitSystem;
  onClose: () => void;
  onSave: (
    durationMin: number,
    caloriesBurned: number | undefined,
    notes: string | undefined,
    exerciseLogs: ExerciseLogEntry[]
  ) => void;
}) {
  const [durationMin, setDurationMin] = useState(45);
  const [caloriesBurned, setCaloriesBurned] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [setsByExercise, setSetsByExercise] = useState<Record<string, { weightKg: number; reps: number }[]>>({});

  function addSet(ex: Exercise) {
    setSetsByExercise((prev) => ({
      ...prev,
      [ex.id]: [...(prev[ex.id] ?? []), { weightKg: 0, reps: 0 }],
    }));
  }

  function updateSet(exId: string, idx: number, field: 'weightKg' | 'reps', value: number) {
    setSetsByExercise((prev) => {
      const sets = [...(prev[exId] ?? [])];
      sets[idx] = { ...sets[idx], [field]: value };
      return { ...prev, [exId]: sets };
    });
  }

  function removeSet(exId: string, idx: number) {
    setSetsByExercise((prev) => ({
      ...prev,
      [exId]: (prev[exId] ?? []).filter((_, i) => i !== idx),
    }));
  }

  function save() {
    const exerciseLogs: ExerciseLogEntry[] = workout.exercises
      .filter((ex) => (setsByExercise[ex.id] ?? []).length > 0)
      .map((ex) => ({
        exerciseId: ex.id,
        exerciseName: ex.name,
        sets: setsByExercise[ex.id].filter((s) => s.weightKg > 0 || s.reps > 0),
      }))
      .filter((e) => e.sets.length > 0);
    onSave(durationMin, caloriesBurned === '' ? undefined : caloriesBurned, notes || undefined, exerciseLogs);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Log: {workout.name}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="block">
            <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Duration (min)</span>
            <input
              type="number"
              min={1}
              className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Calories burned (optional)</span>
            <input
              type="number"
              min={0}
              className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              value={caloriesBurned}
              onChange={(e) => setCaloriesBurned(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </label>
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
          Sets (optional — track weight × reps for progress charts)
        </p>
        <div className="space-y-3 mb-4">
          {workout.exercises.map((ex) => {
            const sets = setsByExercise[ex.id] ?? [];
            return (
              <div key={ex.id} className="rounded-xl border border-gray-200 dark:border-neutral-800 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{ex.name}</p>
                  <button
                    type="button"
                    onClick={() => addSet(ex)}
                    className="flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400"
                  >
                    <Plus size={13} /> Add set
                  </button>
                </div>
                {sets.length > 0 && (
                  <div className="space-y-1.5">
                    {sets.map((s, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs w-10 shrink-0" style={{ color: 'var(--text-muted)' }}>Set {idx + 1}</span>
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          placeholder={weightUnitLabel(unit)}
                          className="w-20 rounded-md border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1 text-sm"
                          value={s.weightKg ? Math.round(displayWeight(s.weightKg, unit) * 10) / 10 : ''}
                          onChange={(e) => updateSet(ex.id, idx, 'weightKg', toKgFromDisplay(Number(e.target.value), unit))}
                        />
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{weightUnitLabel(unit)} ×</span>
                        <input
                          type="number"
                          min={0}
                          placeholder="reps"
                          className="w-16 rounded-md border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1 text-sm"
                          value={s.reps || ''}
                          onChange={(e) => updateSet(ex.id, idx, 'reps', Number(e.target.value))}
                        />
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>reps</span>
                        <button
                          type="button"
                          onClick={() => removeSet(ex.id, idx)}
                          className="ml-auto p-1 rounded text-gray-400 hover:text-red-500"
                          aria-label="Remove set"
                        >
                          <Minus size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <label className="block mb-4">
          <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Notes (optional)</span>
          <textarea
            rows={2}
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-neutral-700 text-sm font-medium">
            Cancel
          </button>
          <button onClick={save} className="flex-1 py-2.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
