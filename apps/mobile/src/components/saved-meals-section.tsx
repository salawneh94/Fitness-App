import { useState } from 'react';
import { Plus, Trash2, Utensils } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useAppStore } from '@/store/useAppStore';
import type { MealType } from '@fittrack/shared';
import { colors } from '@fittrack/shared';
import Card from './ui/card';
import SavedMealBuilderModal from './saved-meal-builder-modal';

const MEAL_CHIPS: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'B' },
  { key: 'lunch', label: 'L' },
  { key: 'dinner', label: 'D' },
  { key: 'snack', label: 'S' },
];

export default function SavedMealsSection() {
  const savedMeals = useAppStore((s) => s.savedMeals);
  const removeSavedMeal = useAppStore((s) => s.removeSavedMeal);
  const logSavedMeal = useAppStore((s) => s.logSavedMeal);
  const [building, setBuilding] = useState(false);

  return (
    <Card
      title="Saved Meals"
      action={
        <Pressable onPress={() => setBuilding(true)} className="flex-row items-center gap-1.5">
          <Plus size={15} color={colors.brandPrimary} />
          <Text className="text-sm font-medium" style={{ color: colors.brandPrimary }}>
            New
          </Text>
        </Pressable>
      }
    >
      {savedMeals.length === 0 ? (
        <Text className="text-sm" style={{ color: colors.textMuted }}>
          Save a frequently-eaten meal once, then re-log it in one tap instead of re-entering it every time.
        </Text>
      ) : (
        <View>
          {savedMeals.map((meal) => {
            const totalCals = meal.items.reduce((s, i) => s + i.calories * i.quantity, 0);
            return (
              <View
                key={meal.id}
                className="flex-row items-center justify-between gap-3 py-2.5 border-b"
                style={{ borderColor: colors.gridline }}
              >
                <View className="flex-row items-center gap-2 flex-1 min-w-0">
                  <Utensils size={15} color={colors.textMuted} />
                  <View className="min-w-0">
                    <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                      {meal.name}
                    </Text>
                    <Text className="text-xs" style={{ color: colors.textMuted }}>
                      {meal.items.length} items · {Math.round(totalCals)} kcal
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-1">
                  {MEAL_CHIPS.map((c) => (
                    <Pressable
                      key={c.key}
                      onPress={() => logSavedMeal(meal.id, c.key)}
                      className="w-7 h-7 rounded-full items-center justify-center border"
                      style={{ borderColor: colors.gridline }}
                    >
                      <Text className="text-xs font-semibold" style={{ color: colors.textSecondary }}>
                        {c.label}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable onPress={() => removeSavedMeal(meal.id)} className="p-1.5">
                    <Trash2 size={15} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}
      {building && <SavedMealBuilderModal onClose={() => setBuilding(false)} />}
    </Card>
  );
}
