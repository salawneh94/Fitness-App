import { useState } from 'react';
import { X } from 'lucide-react-native';
import { Modal, ScrollView, Text, View } from 'react-native';
import type { FoodEntry, MealType } from '@fittrack/shared';
import { colors } from '@fittrack/shared';
import { useAppStore } from '@/store/useAppStore';
import TextField from './ui/text-field';
import PressableScale from './ui/pressable-scale';

const MEALS: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snacks' },
];
const QUICK = [0.5, 1, 1.5, 2];

/**
 * Change how much of something was eaten, or which meal it belongs to.
 *
 * A logged food used to be fixed: two servings typed as one meant deleting it and finding it again.
 * The nutrition per serving stays as logged — this only changes how many, and where.
 */
export default function EditFoodEntryModal({ entry, onClose }: { entry: FoodEntry; onClose: () => void }) {
  const updateFoodEntry = useAppStore((s) => s.updateFoodEntry);
  const [servings, setServings] = useState(String(entry.quantity));
  const [meal, setMeal] = useState<MealType>(entry.meal);
  const quantity = Number(servings.replace(',', '.'));
  const valid = Number.isFinite(quantity) && quantity > 0;
  const per = (n: number) => Math.round(n * (valid ? quantity : 0));

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <ScrollView className="flex-1 p-5" keyboardShouldPersistTaps="handled">
          <View className="flex-row items-start justify-between mb-5 gap-3">
            <View className="flex-1 min-w-0">
              <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                {entry.name}
              </Text>
              <Text className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
                {entry.brand ? `${entry.brand} · ` : ''}per serving: {entry.servingLabel ?? 'serving'} · {Math.round(entry.calories)} kcal
              </Text>
            </View>
            <PressableScale accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} className="p-1">
              <X size={18} color={colors.textPrimary} />
            </PressableScale>
          </View>

          <Text className="text-sm font-medium mb-1.5" style={{ color: colors.textSecondary }}>
            Servings
          </Text>
          <TextField keyboardType="decimal-pad" value={servings} onChangeText={setServings} accessibilityLabel="Servings" />
          <View className="flex-row gap-2 mt-2 mb-5">
            {QUICK.map((q) => {
              const selected = valid && quantity === q;
              return (
                <PressableScale
                  key={q}
                  hapticStyle="selection"
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setServings(String(q))}
                  className="px-3 py-1.5 rounded-full border"
                  style={{ borderColor: selected ? colors.brandPrimary : colors.gridline, backgroundColor: selected ? 'rgba(34,211,238,0.12)' : 'transparent' }}
                >
                  <Text className="text-xs font-medium" style={{ color: selected ? colors.brandPrimary : colors.textSecondary }}>
                    ×{q}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          <Text className="text-sm font-medium mb-1.5" style={{ color: colors.textSecondary }}>
            Meal
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-5">
            {MEALS.map((m) => {
              const selected = m.key === meal;
              return (
                <PressableScale
                  key={m.key}
                  hapticStyle="selection"
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setMeal(m.key)}
                  className="px-3.5 py-1.5 rounded-full border"
                  style={{ borderColor: selected ? colors.brandPrimary : colors.gridline, backgroundColor: selected ? 'rgba(34,211,238,0.12)' : 'transparent' }}
                >
                  <Text className="text-sm font-medium" style={{ color: selected ? colors.brandPrimary : colors.textSecondary }}>
                    {m.label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          <View className="flex-row gap-2 mb-6">
            {[
              { label: 'kcal', value: per(entry.calories) },
              { label: 'protein', value: `${per(entry.proteinG)}g` },
              { label: 'carbs', value: `${per(entry.carbsG)}g` },
              { label: 'fat', value: `${per(entry.fatG)}g` },
            ].map((s) => (
              <View key={s.label} className="flex-1 rounded-lg py-2 items-center" style={{ backgroundColor: colors.chartSurface }}>
                <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                  {s.value}
                </Text>
                <Text className="text-[10px] uppercase" style={{ color: colors.textMuted }}>
                  {s.label}
                </Text>
              </View>
            ))}
          </View>

          <PressableScale
            hapticStyle="success"
            disabled={!valid}
            onPress={() => {
              updateFoodEntry(entry.id, { quantity, meal });
              onClose();
            }}
            className="py-3 rounded-full items-center"
            style={{ backgroundColor: colors.brandPrimaryDark, opacity: valid ? 1 : 0.5 }}
          >
            <Text className="text-white text-sm font-semibold">Save changes</Text>
          </PressableScale>
        </ScrollView>
      </View>
    </Modal>
  );
}
