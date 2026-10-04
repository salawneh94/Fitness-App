import { useState } from 'react';
import { X } from 'lucide-react-native';
import { Modal, ScrollView, Text, View } from 'react-native';
import type { CardioActivity, CardioEntry } from '@fittrack/shared';
import {
  CARDIO_ACTIVITIES,
  colors,
  distanceUnitLabel,
  estimateCardioCalories,
  formatPace,
  toKmFromDisplay,
  todayISO,
} from '@fittrack/shared';
import { useAppStore } from '@/store/useAppStore';
import TextField from './ui/text-field';
import DayChips from './ui/day-chips';
import PressableScale from './ui/pressable-scale';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-sm font-medium mb-1.5" style={{ color: colors.textSecondary }}>
      {children}
    </Text>
  );
}

/**
 * Log a run, walk, ride, row or swim with how long and how far.
 *
 * Until now cardio could only be logged as a "workout" with a duration — no distance, so no pace,
 * no sense of getting faster or going further. For someone whose goal is endurance, that was most
 * of what they'd want to track.
 */
export default function LogCardioModal({ onClose, initialActivity = 'run' }: { onClose: () => void; initialActivity?: CardioActivity }) {
  const profile = useAppStore((s) => s.profile)!;
  const addWorkoutLog = useAppStore((s) => s.addWorkoutLog);
  const unit = profile.unitSystem;

  const [activity, setActivity] = useState<CardioActivity>(initialActivity);
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [calories, setCalories] = useState<string | null>(null); // null = use the estimate
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(todayISO());

  const durationMin = Number(duration) || 0;
  const distanceKm = distance === '' ? undefined : toKmFromDisplay(Number(distance) || 0, unit) || undefined;
  const entry: CardioEntry = { activity, durationMin, distanceKm };
  const pace = durationMin > 0 ? formatPace(entry, unit) : null;
  const estimate = estimateCardioCalories(entry, profile.weightKg);
  const caloriesValue = calories ?? (estimate !== null ? String(estimate) : '');
  const label = CARDIO_ACTIVITIES.find((a) => a.id === activity)!.label;

  function save() {
    if (durationMin <= 0) return;
    addWorkoutLog({
      date,
      workoutName: label,
      durationMin,
      caloriesBurned: caloriesValue === '' ? undefined : Number(caloriesValue) || undefined,
      notes: notes.trim() || undefined,
      cardio: [entry],
    });
    onClose();
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <ScrollView className="flex-1 p-5" keyboardShouldPersistTaps="handled">
          <View className="flex-row items-center justify-between mb-5">
            <Text className="font-semibold" style={{ color: colors.textPrimary }}>
              Log cardio
            </Text>
            <PressableScale accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} className="p-1">
              <X size={18} color={colors.textPrimary} />
            </PressableScale>
          </View>

          <View className="mb-4">
            <DayChips value={date} onChange={setDate} />
          </View>

          <View className="flex-row flex-wrap gap-2 mb-5">
            {CARDIO_ACTIVITIES.map((a) => {
              const selected = a.id === activity;
              return (
                <PressableScale
                  key={a.id}
                  hapticStyle="selection"
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setActivity(a.id);
                    setCalories(null); // a new activity means a new estimate
                  }}
                  className="px-4 py-2 rounded-full border"
                  style={{
                    borderColor: selected ? colors.brandPrimary : colors.gridline,
                    backgroundColor: selected ? 'rgba(34,211,238,0.12)' : 'transparent',
                  }}
                >
                  <Text className="text-sm font-medium" style={{ color: selected ? colors.brandPrimary : colors.textSecondary }}>
                    {a.label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <FieldLabel>Duration (min)</FieldLabel>
              <TextField keyboardType="numeric" value={duration} onChangeText={setDuration} placeholder="30" accessibilityLabel="Duration in minutes" />
            </View>
            {activity !== 'other' && (
              <View className="flex-1">
                <FieldLabel>Distance ({distanceUnitLabel(unit)})</FieldLabel>
                <TextField
                  keyboardType="decimal-pad"
                  value={distance}
                  onChangeText={setDistance}
                  placeholder="optional"
                  accessibilityLabel={`Distance in ${unit === 'imperial' ? 'miles' : 'kilometres'}`}
                />
              </View>
            )}
          </View>

          {pace && (
            <View className="rounded-xl py-3 items-center mb-4" style={{ backgroundColor: colors.chartSurface }}>
              <Text className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                {pace}
              </Text>
              <Text className="text-[10px] uppercase" style={{ color: colors.textMuted }}>
                {activity === 'cycle' ? 'average speed' : 'average pace'}
              </Text>
            </View>
          )}

          <View className="mb-4">
            <FieldLabel>Calories burned</FieldLabel>
            <TextField
              keyboardType="numeric"
              value={caloriesValue}
              onChangeText={setCalories}
              placeholder="optional"
              accessibilityLabel="Calories burned"
            />
            {calories === null && estimate !== null && (
              <Text className="text-xs mt-1" style={{ color: colors.textMuted }}>
                Estimated from your weight{distanceKm && (activity === 'run' || activity === 'walk') ? ' and distance' : ' and time'} — edit if your
                watch says otherwise.
              </Text>
            )}
          </View>

          <View className="mb-6">
            <FieldLabel>Notes</FieldLabel>
            <TextField value={notes} onChangeText={setNotes} placeholder="How did it feel?" />
          </View>

          <PressableScale
            hapticStyle="success"
            onPress={save}
            disabled={durationMin <= 0}
            className="py-3 rounded-full items-center"
            style={{ backgroundColor: colors.brandPrimaryDark, opacity: durationMin <= 0 ? 0.5 : 1 }}
          >
            <Text className="text-white text-sm font-semibold">Save {label.toLowerCase()}</Text>
          </PressableScale>
        </ScrollView>
      </View>
    </Modal>
  );
}
