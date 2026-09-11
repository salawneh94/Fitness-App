import { useState } from 'react';
import { Minus, X } from 'lucide-react-native';
import { Modal, ScrollView, Text, View } from 'react-native';
import type { ExerciseLogEntry, UnitSystem, WorkoutLogEntry } from '@fittrack/shared';
import { colors, displayWeight, toKgFromDisplay, weightUnitLabel } from '@fittrack/shared';
import TextField from './ui/text-field';
import PressableScale from '@/components/ui/pressable-scale';

interface DraftSet {
  weight: string;
  reps: string;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-xs font-medium mb-1" style={{ color: colors.textSecondary }}>
      {children}
    </Text>
  );
}

/**
 * Correct a session that's already been saved.
 *
 * Until now a workout log was write-once: the only way to fix a weight typed as 100 instead of
 * 10 was to delete the whole session and re-enter every set. That single bad number also flows
 * straight into the strength chart and the plateau detection, so leaving it there quietly
 * corrupts the two features that read set history.
 */
export default function EditWorkoutLogModal({
  log,
  unit,
  onSave,
  onClose,
}: {
  log: WorkoutLogEntry;
  unit: UnitSystem;
  onSave: (patch: Partial<Omit<WorkoutLogEntry, 'id'>>) => void;
  onClose: () => void;
}) {
  const fmt = (kg: number) => String(Math.round(displayWeight(kg, unit) * 10) / 10);

  const [durationMin, setDurationMin] = useState(String(log.durationMin));
  const [caloriesBurned, setCaloriesBurned] = useState(log.caloriesBurned ? String(log.caloriesBurned) : '');
  const [notes, setNotes] = useState(log.notes ?? '');
  const [exercises, setExercises] = useState<{ entry: ExerciseLogEntry; sets: DraftSet[] }[]>(
    (log.exerciseLogs ?? []).map((entry) => ({
      entry,
      sets: entry.sets.map((s) => ({ weight: fmt(s.weightKg), reps: String(s.reps) })),
    }))
  );

  function patchSet(exIndex: number, setIndex: number, patch: Partial<DraftSet>) {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i !== exIndex
          ? ex
          : { ...ex, sets: ex.sets.map((s, j) => (j === setIndex ? { ...s, ...patch } : s)) }
      )
    );
  }

  function removeSet(exIndex: number, setIndex: number) {
    setExercises((prev) =>
      prev.map((ex, i) => (i !== exIndex ? ex : { ...ex, sets: ex.sets.filter((_, j) => j !== setIndex) }))
    );
  }

  function save() {
    const exerciseLogs: ExerciseLogEntry[] = exercises
      .map(({ entry, sets }) => ({
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        sets: sets.map((s) => ({
          weightKg: s.weight === '' ? 0 : toKgFromDisplay(Number(s.weight) || 0, unit),
          reps: Number(s.reps) || 0,
        })),
      }))
      // An exercise whose every set was deleted is an exercise that didn't happen.
      .filter((e) => e.sets.length > 0);

    onSave({
      durationMin: Math.max(1, Number(durationMin) || 1),
      caloriesBurned: caloriesBurned === '' ? undefined : Number(caloriesBurned) || undefined,
      notes: notes.trim() === '' ? undefined : notes.trim(),
      exerciseLogs,
    });
    onClose();
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <ScrollView className="flex-1 p-5" keyboardShouldPersistTaps="handled">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="font-semibold" style={{ color: colors.textPrimary }}>
              Edit session
            </Text>
            <PressableScale accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} className="p-1">
              <X size={18} color={colors.textPrimary} />
            </PressableScale>
          </View>
          <Text className="text-xs mb-5" style={{ color: colors.textMuted }}>
            {log.workoutName} ·{' '}
            {new Date(log.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>

          <View className="flex-row gap-3 mb-5">
            <View className="flex-1">
              <FieldLabel>Duration (min)</FieldLabel>
              <TextField keyboardType="numeric" value={durationMin} onChangeText={setDurationMin} />
            </View>
            <View className="flex-1">
              <FieldLabel>Calories burned</FieldLabel>
              <TextField
                keyboardType="numeric"
                placeholder="optional"
                value={caloriesBurned}
                onChangeText={setCaloriesBurned}
              />
            </View>
          </View>

          {exercises.map((ex, exIndex) => (
            <View key={ex.entry.exerciseId} className="mb-5">
              <Text className="text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                {ex.entry.exerciseName}
              </Text>
              {ex.sets.length === 0 ? (
                <Text className="text-xs" style={{ color: colors.textMuted }}>
                  All sets removed — this exercise will be dropped from the session.
                </Text>
              ) : (
                ex.sets.map((s, setIndex) => (
                  <View key={setIndex} className="flex-row items-center gap-2 mb-2">
                    <Text className="text-xs w-10" style={{ color: colors.textMuted }}>
                      Set {setIndex + 1}
                    </Text>
                    <TextField
                      className="flex-1"
                      keyboardType="numeric"
                      placeholder={weightUnitLabel(unit)}
                      value={s.weight}
                      onChangeText={(weight) => patchSet(exIndex, setIndex, { weight })}
                    />
                    <Text className="text-xs" style={{ color: colors.textMuted }}>
                      ×
                    </Text>
                    <TextField
                      className="flex-1"
                      keyboardType="numeric"
                      placeholder="reps"
                      value={s.reps}
                      onChangeText={(reps) => patchSet(exIndex, setIndex, { reps })}
                    />
                    <PressableScale
                      accessibilityLabel={`Remove set ${setIndex + 1} of ${ex.entry.exerciseName}`}
                      accessibilityRole="button"
                      hapticStyle="warning"
                      onPress={() => removeSet(exIndex, setIndex)}
                      className="p-1"
                    >
                      <Minus size={15} color={colors.textMuted} />
                    </PressableScale>
                  </View>
                ))
              )}
            </View>
          ))}

          <View className="mb-5">
            <FieldLabel>Notes</FieldLabel>
            <TextField
              multiline
              numberOfLines={3}
              placeholder="How did it feel?"
              value={notes}
              onChangeText={setNotes}
              style={{ minHeight: 72, textAlignVertical: 'top' }}
            />
          </View>

          <View className="flex-row gap-2 pb-8">
            <PressableScale
              onPress={onClose}
              className="flex-1 py-2.5 rounded-lg border items-center"
              style={{ borderColor: colors.gridline }}
            >
              <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                Cancel
              </Text>
            </PressableScale>
            <PressableScale
              onPress={save}
              hapticStyle="success"
              className="flex-1 py-2.5 rounded-full items-center"
              style={{ backgroundColor: colors.brandPrimaryDark }}
            >
              <Text className="text-white text-sm font-semibold">Save changes</Text>
            </PressableScale>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
