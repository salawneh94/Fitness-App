import { useState } from 'react';
import { Clock, Minus, Plus, PlayCircle, Trash2, X, Zap } from 'lucide-react-native';
import { Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';
import type { Exercise, ExerciseLogEntry, ScheduledWorkout, UnitSystem, Weekday } from '@fittrack/shared';
import { EXERCISE_LIBRARY, colors, computeRestDayInsight, displayWeight, toKgFromDisplay, todayISO, weightUnitLabel } from '@fittrack/shared';
import { randomUUID } from 'expo-crypto';
import Card from '@/components/ui/card';
import RestDayBanner from '@/components/rest-day-banner';
import ExerciseVideoModal from '@/components/exercise-video-modal';
import GuidedWorkoutPlayer from '@/components/guided-workout-player';
import TextField from '@/components/ui/text-field';
import PressableScale from '@/components/ui/pressable-scale';

const WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function WorkoutsScreen() {
  const profile = useAppStore((s) => s.profile)!; // gated by root layout
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
      setScheduledWorkouts([...others, { id: randomUUID(), day, name: name.trim(), exercises }]);
    } else {
      setScheduledWorkouts(others);
    }
    setEditingDay(null);
  }

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short' });

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }} edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 16, gap: 24 }}>
        <View>
          <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
            Workout Tracker
          </Text>
          <Text className="text-sm" style={{ color: colors.textSecondary }}>
            Your weekly schedule — tap a day to see exercises & video demos.
          </Text>
        </View>

        {restInsight.shouldRest && <RestDayBanner consecutiveDays={restInsight.consecutiveTrainedDays} />}

        <View className="flex-row flex-wrap gap-2.5">
          {WEEKDAYS.map((day) => {
            const w = workoutForDay(day);
            const isToday = todayLabel === day;
            return (
              <PressableScale hapticStyle="selection"
                key={day}
                accessibilityRole="button"
                accessibilityLabel={`${day}: ${w ? w.name : 'Rest day'}`}
                onPress={() => setActiveDay(day)}
                className="rounded-2xl border p-3"
                style={{
                  width: '30%',
                  minHeight: 90,
                  backgroundColor: isToday ? 'rgba(34,211,238,0.08)' : colors.chartSurface,
                  borderColor: isToday ? colors.brandPrimary : colors.gridline,
                }}
              >
                <Text className="text-xs font-semibold" style={{ color: colors.textMuted }}>
                  {day}
                </Text>
                <Text
                  className="text-sm font-medium mt-1"
                  numberOfLines={2}
                  style={{ color: w ? colors.textPrimary : colors.textMuted }}
                >
                  {w ? w.name : 'Rest'}
                </Text>
                {w && (
                  <Text className="text-[11px] mt-1" style={{ color: colors.textMuted }}>
                    {w.exercises.length} exercises
                  </Text>
                )}
              </PressableScale>
            );
          })}
        </View>

        <Card title="Recent Activity">
          {workoutLogs.length === 0 ? (
            <Text className="text-sm" style={{ color: colors.textMuted }}>
              No workouts logged yet. Complete a session and log it to build your history.
            </Text>
          ) : (
            <View>
              {[...workoutLogs].reverse().slice(0, 10).map((log) => (
                <View
                  key={log.id}
                  className="flex-row items-center justify-between py-2.5 border-b"
                  style={{ borderColor: colors.gridline }}
                >
                  <View className="flex-1 min-w-0">
                    <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                      {log.workoutName}
                    </Text>
                    <View className="flex-row items-center gap-1 mt-0.5">
                      <Clock size={12} color={colors.textMuted} />
                      <Text className="text-xs" style={{ color: colors.textMuted }}>
                        {log.durationMin} min ·{' '}
                        {new Date(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        {log.caloriesBurned ? ` · ${log.caloriesBurned} kcal` : ''}
                        {log.exerciseLogs && log.exerciseLogs.length > 0
                          ? ` · ${log.exerciseLogs.reduce((s, e) => s + e.sets.length, 0)} sets logged`
                          : ''}
                      </Text>
                    </View>
                  </View>
                  <PressableScale accessibilityLabel="Delete workout log" accessibilityRole="button" hapticStyle="warning" onPress={() => removeWorkoutLog(log.id)} className="p-1.5">
                    <Trash2 size={15} color={colors.textMuted} />
                  </PressableScale>
                </View>
              ))}
            </View>
          )}
        </Card>
      </ScrollView>

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
          unit={profile.unitSystem}
          onClose={() => setLoggingDay(null)}
          onSave={(durationMin, caloriesBurned, notes, exerciseLogs) => {
            addWorkoutLog({ date: todayISO(), workoutName: loggingDay.name, durationMin, caloriesBurned, notes, exerciseLogs });
            setLoggingDay(null);
          }}
        />
      )}

      {playingWorkout && (
        <GuidedWorkoutPlayer
          workout={playingWorkout}
          unit={profile.unitSystem}
          onCancel={() => setPlayingWorkout(null)}
          onFinish={(durationMin, exerciseLogs, caloriesBurned, notes) => {
            addWorkoutLog({ date: todayISO(), workoutName: playingWorkout.name, durationMin, caloriesBurned, notes, exerciseLogs });
            setPlayingWorkout(null);
          }}
        />
      )}
    </SafeAreaView>
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
  const [videoExercise, setVideoExercise] = useState<Exercise | null>(null);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <ScrollView className="flex-1 p-5" contentContainerStyle={{ paddingBottom: 24 }}>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="font-semibold flex-1 mr-2" style={{ color: colors.textPrimary }}>
              {day} — {workout?.name ?? 'Rest Day'}
            </Text>
            <PressableScale accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} className="p-1">
              <X size={18} color={colors.textPrimary} />
            </PressableScale>
          </View>

          {workout ? (
            <>
              <View className="gap-2 mb-4">
                {workout.exercises.map((ex) => (
                  <View
                    key={ex.id}
                    className="flex-row items-center justify-between gap-3 p-3 rounded-xl"
                    style={{ backgroundColor: colors.chartSurface }}
                  >
                    <View className="flex-1 min-w-0">
                      <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                        {ex.name}
                      </Text>
                      <Text className="text-xs" style={{ color: colors.textMuted }}>
                        {ex.equipment} {ex.sets && ex.reps ? `· ${ex.sets} × ${ex.reps}` : ex.notes ? `· ${ex.notes}` : ''}
                      </Text>
                    </View>
                    <PressableScale accessibilityLabel={`Watch ${ex.name} demo`} accessibilityRole="button" onPress={() => setVideoExercise(ex)} className="flex-row items-center gap-1">
                      <PlayCircle size={16} color={colors.brandPrimary} />
                      <Text className="text-xs font-medium" style={{ color: colors.brandPrimary }}>
                        Demo
                      </Text>
                    </PressableScale>
                  </View>
                ))}
              </View>
              {videoExercise && <ExerciseVideoModal exercise={videoExercise} onClose={() => setVideoExercise(null)} />}
              <View className="flex-row gap-2">
                <PressableScale onPress={onEdit} className="py-2.5 px-4 rounded-lg border items-center" style={{ borderColor: colors.gridline }}>
                  <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                    Edit
                  </Text>
                </PressableScale>
                <PressableScale hapticStyle="success"
                  onPress={() => onLog(workout)}
                  className="flex-1 py-2.5 rounded-full border items-center"
                  style={{ borderColor: colors.brandPrimaryDark }}
                >
                  <Text className="text-sm font-semibold" style={{ color: colors.brandPrimary }}>
                    Log as done
                  </Text>
                </PressableScale>
                <PressableScale
                  onPress={() => onPlay(workout)}
                  className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-full"
                  style={{ backgroundColor: colors.brandPrimaryDark }}
                >
                  <Zap size={15} color="white" />
                  <Text className="text-white text-sm font-semibold">Start Workout</Text>
                </PressableScale>
              </View>
            </>
          ) : (
            <View className="items-center py-6">
              <Text className="text-sm mb-4" style={{ color: colors.textMuted }}>
                No workout scheduled for this day.
              </Text>
              <PressableScale onPress={onEdit} className="flex-row items-center gap-1.5 py-2.5 px-4 rounded-full" style={{ backgroundColor: colors.brandPrimaryDark }}>
                <Plus size={16} color="white" />
                <Text className="text-white text-sm font-semibold">Add a workout</Text>
              </PressableScale>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
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
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <ScrollView className="flex-1 p-5" contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="font-semibold" style={{ color: colors.textPrimary }}>
              Edit {day}
            </Text>
            <PressableScale accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} className="p-1">
              <X size={18} color={colors.textPrimary} />
            </PressableScale>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium mb-1.5" style={{ color: colors.textSecondary }}>
              Workout name
            </Text>
            <TextField value={name} onChangeText={setName} placeholder="e.g. Push Day" />
          </View>

          <View className="gap-4 mb-4">
            {categories.map((cat) => (
              <View key={cat}>
                <Text className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: colors.textMuted }}>
                  {cat.replace('_', ' ')}
                </Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {EXERCISE_LIBRARY.filter((e) => e.category === cat).map((ex) => {
                    const isSelected = selected.includes(ex.id);
                    return (
                      <PressableScale hapticStyle="selection"
                        key={ex.id}
                        onPress={() => toggle(ex.id)}
                        className="px-2.5 py-1.5 rounded-full border"
                        style={{
                          backgroundColor: isSelected ? colors.brandPrimaryDark : 'transparent',
                          borderColor: isSelected ? colors.brandPrimaryDark : colors.gridline,
                        }}
                      >
                        <Text className="text-xs" style={{ color: isSelected ? 'white' : colors.textSecondary }}>
                          {ex.name}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>

          <View className="flex-row gap-2">
            <PressableScale onPress={onClose} className="flex-1 py-2.5 rounded-lg border items-center" style={{ borderColor: colors.gridline }}>
              <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                Cancel
              </Text>
            </PressableScale>
            <PressableScale hapticStyle="success" onPress={() => onSave(name, selected)} className="flex-1 py-2.5 rounded-full items-center" style={{ backgroundColor: colors.brandPrimaryDark }}>
              <Text className="text-white text-sm font-semibold">Save</Text>
            </PressableScale>
          </View>
        </ScrollView>
      </View>
    </Modal>
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
  onSave: (durationMin: number, caloriesBurned: number | undefined, notes: string | undefined, exerciseLogs: ExerciseLogEntry[]) => void;
}) {
  const [durationMin, setDurationMin] = useState('45');
  const [caloriesBurned, setCaloriesBurned] = useState('');
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
    onSave(Number(durationMin) || 0, caloriesBurned === '' ? undefined : Number(caloriesBurned), notes || undefined, exerciseLogs);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <ScrollView className="flex-1 p-5" contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="font-semibold" style={{ color: colors.textPrimary }}>
              Log: {workout.name}
            </Text>
            <PressableScale accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} className="p-1">
              <X size={18} color={colors.textPrimary} />
            </PressableScale>
          </View>

          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <Text className="text-sm font-medium mb-1.5" style={{ color: colors.textSecondary }}>
                Duration (min)
              </Text>
              <TextField keyboardType="numeric" value={durationMin} onChangeText={setDurationMin} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium mb-1.5" style={{ color: colors.textSecondary }}>
                Calories burned (optional)
              </Text>
              <TextField keyboardType="numeric" value={caloriesBurned} onChangeText={setCaloriesBurned} />
            </View>
          </View>

          <Text className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.textMuted }}>
            Sets (optional — track weight × reps for progress charts)
          </Text>
          <View className="gap-3 mb-4">
            {workout.exercises.map((ex) => {
              const sets = setsByExercise[ex.id] ?? [];
              return (
                <View key={ex.id} className="rounded-xl border p-3" style={{ borderColor: colors.gridline }}>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                      {ex.name}
                    </Text>
                    <PressableScale onPress={() => addSet(ex)} className="flex-row items-center gap-1">
                      <Plus size={13} color={colors.brandPrimary} />
                      <Text className="text-xs font-medium" style={{ color: colors.brandPrimary }}>
                        Add set
                      </Text>
                    </PressableScale>
                  </View>
                  {sets.length > 0 && (
                    <View className="gap-1.5">
                      {sets.map((s, idx) => (
                        <View key={idx} className="flex-row items-center gap-2">
                          <Text className="text-xs w-10" style={{ color: colors.textMuted }}>
                            Set {idx + 1}
                          </Text>
                          <TextField
                            className="w-16"
                            keyboardType="numeric"
                            placeholder={weightUnitLabel(unit)}
                            value={s.weightKg ? String(Math.round(displayWeight(s.weightKg, unit) * 10) / 10) : ''}
                            onChangeText={(v) => updateSet(ex.id, idx, 'weightKg', toKgFromDisplay(Number(v) || 0, unit))}
                          />
                          <Text className="text-xs" style={{ color: colors.textMuted }}>
                            {weightUnitLabel(unit)} ×
                          </Text>
                          <TextField
                            className="w-14"
                            keyboardType="numeric"
                            placeholder="reps"
                            value={s.reps ? String(s.reps) : ''}
                            onChangeText={(v) => updateSet(ex.id, idx, 'reps', Number(v) || 0)}
                          />
                          <Text className="text-xs" style={{ color: colors.textMuted }}>
                            reps
                          </Text>
                          <PressableScale accessibilityLabel="Remove set" accessibilityRole="button" hapticStyle="warning" onPress={() => removeSet(ex.id, idx)} className="ml-auto p-1">
                            <Minus size={14} color={colors.textMuted} />
                          </PressableScale>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium mb-1.5" style={{ color: colors.textSecondary }}>
              Notes (optional)
            </Text>
            <TextField value={notes} onChangeText={setNotes} multiline numberOfLines={2} style={{ height: 64, textAlignVertical: 'top' }} />
          </View>

          <View className="flex-row gap-2">
            <PressableScale onPress={onClose} className="flex-1 py-2.5 rounded-lg border items-center" style={{ borderColor: colors.gridline }}>
              <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                Cancel
              </Text>
            </PressableScale>
            <PressableScale hapticStyle="success" onPress={save} className="flex-1 py-2.5 rounded-full items-center" style={{ backgroundColor: colors.brandPrimaryDark }}>
              <Text className="text-white text-sm font-semibold">Save</Text>
            </PressableScale>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
