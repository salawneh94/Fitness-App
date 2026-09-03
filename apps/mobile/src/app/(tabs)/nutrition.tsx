import { useState } from 'react';
import { Plus, ScanBarcode, Trash2 } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';
import type { MealType, Micronutrients } from '@fittrack/shared';
import { calcDailyTargets, colors, todayISO } from '@fittrack/shared';
import Card from '@/components/ui/card';
import CalorieRing from '@/components/charts/calorie-ring';
import MacroBars from '@/components/charts/macro-bars';
import MicronutrientList from '@/components/micronutrient-list';
import AddFoodModal from '@/components/add-food-modal';
import SavedMealsSection from '@/components/saved-meals-section';

const MEALS: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snacks' },
];

export default function NutritionScreen() {
  const profile = useAppStore((s) => s.profile)!; // gated by root layout
  const foodEntries = useAppStore((s) => s.foodEntries);
  const removeFoodEntry = useAppStore((s) => s.removeFoodEntry);
  const [addingMeal, setAddingMeal] = useState<MealType | null>(null);

  const today = todayISO();
  const todaysFood = foodEntries.filter((f) => f.date === today);
  const targets = calcDailyTargets(profile);

  const consumed = todaysFood.reduce(
    (acc, f) => ({
      calories: acc.calories + f.calories * f.quantity,
      proteinG: acc.proteinG + f.proteinG * f.quantity,
      carbsG: acc.carbsG + f.carbsG * f.quantity,
      fatG: acc.fatG + f.fatG * f.quantity,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );

  const microTotals: Micronutrients = {};
  for (const f of todaysFood) {
    if (!f.micros) continue;
    for (const [k, v] of Object.entries(f.micros)) {
      if (typeof v !== 'number') continue;
      const key = k as keyof Micronutrients;
      microTotals[key] = (microTotals[key] ?? 0) + v * f.quantity;
    }
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }} edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 16, gap: 24 }}>
        <View>
          <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
            Nutrition
          </Text>
          <Text className="text-sm" style={{ color: colors.textSecondary }}>
            Log meals manually or scan a barcode for instant nutrition info.
          </Text>
        </View>

        <Card title="Calories">
          <CalorieRing consumed={consumed.calories} target={targets.calories} />
        </Card>

        <Card title="Macros">
          <MacroBars
            protein={{ consumed: consumed.proteinG, target: targets.proteinG }}
            carbs={{ consumed: consumed.carbsG, target: targets.carbsG }}
            fat={{ consumed: consumed.fatG, target: targets.fatG }}
          />
        </Card>

        <Card title="Micronutrients Today">
          <MicronutrientList totals={microTotals} />
        </Card>

        <SavedMealsSection />

        <View style={{ gap: 16 }}>
          {MEALS.map(({ key, label }) => {
            const entries = todaysFood.filter((f) => f.meal === key);
            const mealCals = entries.reduce((s, e) => s + e.calories * e.quantity, 0);
            return (
              <Card
                key={key}
                title={label}
                action={
                  <Text className="text-xs" style={{ color: colors.textMuted }}>
                    {Math.round(mealCals)} kcal
                  </Text>
                }
              >
                {entries.length === 0 ? (
                  <Text className="text-sm mb-3" style={{ color: colors.textMuted }}>
                    Nothing logged yet.
                  </Text>
                ) : (
                  <View className="mb-3">
                    {entries.map((e) => (
                      <View
                        key={e.id}
                        className="flex-row items-center justify-between py-2 border-b"
                        style={{ borderColor: colors.gridline }}
                      >
                        <View className="flex-1 min-w-0">
                          <View className="flex-row items-center gap-1.5">
                            {e.source === 'barcode' && <ScanBarcode size={13} color={colors.textMuted} />}
                            <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                              {e.name}
                            </Text>
                          </View>
                          <Text className="text-xs" style={{ color: colors.textMuted }}>
                            {e.quantity} × {e.servingLabel ?? 'serving'} · {Math.round(e.calories * e.quantity)} kcal
                          </Text>
                        </View>
                        <Pressable onPress={() => removeFoodEntry(e.id)} className="p-1.5">
                          <Trash2 size={15} color={colors.textMuted} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
                <Pressable onPress={() => setAddingMeal(key)} className="flex-row items-center gap-1.5">
                  <Plus size={16} color={colors.brandPrimary} />
                  <Text className="text-sm font-medium" style={{ color: colors.brandPrimary }}>
                    Add food
                  </Text>
                </Pressable>
              </Card>
            );
          })}
        </View>
      </ScrollView>

      {addingMeal && <AddFoodModal meal={addingMeal} onClose={() => setAddingMeal(null)} />}
    </SafeAreaView>
  );
}
