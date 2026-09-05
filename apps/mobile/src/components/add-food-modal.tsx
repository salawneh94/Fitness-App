import { useState } from 'react';
import { X, ScanBarcode, PenLine, Loader2, CircleCheck, Utensils } from 'lucide-react-native';
import { Modal, ScrollView, Text, View } from 'react-native';
import { useAppStore } from '@/store/useAppStore';
import type { FoodEntry, MealType } from '@fittrack/shared';
import { todayISO, colors } from '@fittrack/shared';
import { lookupBarcode, type ScannedProduct } from '@/lib/food-api';
import BarcodeScannerModal from './barcode-scanner-modal';
import TextField from './ui/text-field';
import PressableScale from '@/components/ui/pressable-scale';

type Mode = 'choose' | 'scan' | 'manual' | 'confirmScanned' | 'savedMeals';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-sm font-medium mb-1.5" style={{ color: colors.textSecondary }}>
      {children}
    </Text>
  );
}

function ChoiceRow({ icon: Icon, title, sub, onPress }: { icon: typeof ScanBarcode; title: string; sub: string; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      className="flex-row items-center gap-3 p-4 rounded-xl border"
      style={{ borderColor: colors.gridline }}
    >
      <Icon color={colors.brandPrimary} size={22} />
      <View className="flex-1">
        <Text className="font-medium text-sm" style={{ color: colors.textPrimary }}>
          {title}
        </Text>
        <Text className="text-xs" style={{ color: colors.textMuted }}>
          {sub}
        </Text>
      </View>
    </PressableScale>
  );
}

export default function AddFoodModal({ meal, onClose }: { meal: MealType; onClose: () => void }) {
  const addFoodEntry = useAppStore((s) => s.addFoodEntry);
  const savedMeals = useAppStore((s) => s.savedMeals);
  const logSavedMeal = useAppStore((s) => s.logSavedMeal);
  const [mode, setMode] = useState<Mode>('choose');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState<ScannedProduct | null>(null);
  const [grams, setGrams] = useState('100');

  const [manual, setManual] = useState({
    name: '',
    calories: '0',
    proteinG: '0',
    carbsG: '0',
    fatG: '0',
    quantity: '1',
    servingLabel: 'serving',
  });

  async function handleDetected(barcode: string) {
    setMode('choose');
    setLoading(true);
    setError(null);
    try {
      const product = await lookupBarcode(barcode);
      if (!product) {
        setError(`No product found for barcode ${barcode}. Try manual entry.`);
      } else {
        setScanned(product);
        setGrams('100');
        setMode('confirmScanned');
      }
    } catch {
      setError('Could not reach the product database. Check your connection or use manual entry.');
    } finally {
      setLoading(false);
    }
  }

  function confirmScanned() {
    if (!scanned) return;
    const g = Number(grams) || 0;
    const factor = g / 100;
    const entry: Omit<FoodEntry, 'id' | 'loggedAt'> = {
      date: todayISO(),
      meal,
      name: scanned.name,
      brand: scanned.brand,
      quantity: 1,
      servingLabel: `${g} g`,
      calories: Math.round(scanned.caloriesPer100g * factor),
      proteinG: Math.round(scanned.proteinPer100g * factor * 10) / 10,
      carbsG: Math.round(scanned.carbsPer100g * factor * 10) / 10,
      fatG: Math.round(scanned.fatPer100g * factor * 10) / 10,
      micros: Object.fromEntries(
        Object.entries(scanned.microsPer100g)
          .filter(([, v]) => typeof v === 'number')
          .map(([k, v]) => [k, Math.round((v as number) * factor * 10) / 10])
      ),
      source: 'barcode',
      barcode: scanned.barcode,
    };
    addFoodEntry(entry);
    onClose();
  }

  function submitManual() {
    if (!manual.name.trim()) return;
    addFoodEntry({
      date: todayISO(),
      meal,
      name: manual.name.trim(),
      quantity: Number(manual.quantity) || 1,
      servingLabel: manual.servingLabel,
      calories: Number(manual.calories) || 0,
      proteinG: Number(manual.proteinG) || 0,
      carbsG: Number(manual.carbsG) || 0,
      fatG: Number(manual.fatG) || 0,
      source: 'manual',
    });
    onClose();
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <ScrollView className="flex-1 p-5" keyboardShouldPersistTaps="handled">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="font-semibold capitalize" style={{ color: colors.textPrimary }}>
              Add to {meal}
            </Text>
            <PressableScale accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} className="p-1">
              <X size={18} color={colors.textPrimary} />
            </PressableScale>
          </View>

          {loading && (
            <View className="flex-row items-center justify-center gap-2 py-8">
              <Loader2 size={18} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary }}>Looking up product…</Text>
            </View>
          )}

          {!loading && mode === 'choose' && (
            <View className="gap-3">
              {error && (
                <Text className="text-sm" style={{ color: colors.statusWarning }}>
                  {error}
                </Text>
              )}
              <ChoiceRow
                icon={ScanBarcode}
                title="Scan Barcode / QR"
                sub="Auto-fill nutrition from packaging"
                onPress={() => setMode('scan')}
              />
              <ChoiceRow icon={PenLine} title="Manual Entry" sub="Type in the details yourself" onPress={() => setMode('manual')} />
              {savedMeals.length > 0 && (
                <ChoiceRow
                  icon={Utensils}
                  title="From Saved Meals"
                  sub="Quick-add a meal you've saved before"
                  onPress={() => setMode('savedMeals')}
                />
              )}
            </View>
          )}

          {mode === 'savedMeals' && (
            <View className="gap-2">
              {savedMeals.map((m) => {
                const totalCals = m.items.reduce((s, i) => s + i.calories * i.quantity, 0);
                return (
                  <PressableScale
                    key={m.id}
                    onPress={() => {
                      logSavedMeal(m.id, meal);
                      onClose();
                    }}
                    className="flex-row items-center justify-between p-3 rounded-xl border"
                    style={{ borderColor: colors.gridline }}
                  >
                    <View>
                      <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                        {m.name}
                      </Text>
                      <Text className="text-xs" style={{ color: colors.textMuted }}>
                        {m.items.length} items
                      </Text>
                    </View>
                    <Text className="text-xs font-medium" style={{ color: colors.textMuted }}>
                      {Math.round(totalCals)} kcal
                    </Text>
                  </PressableScale>
                );
              })}
              <PressableScale hapticStyle="selection"
                onPress={() => setMode('choose')}
                className="py-2.5 rounded-lg border items-center"
                style={{ borderColor: colors.gridline }}
              >
                <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                  Back
                </Text>
              </PressableScale>
            </View>
          )}

          {mode === 'scan' && <BarcodeScannerModal onDetected={handleDetected} onClose={() => setMode('choose')} />}

          {mode === 'confirmScanned' && scanned && (
            <View className="gap-4">
              <View className="flex-row items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: 'rgba(34,211,238,0.1)' }}>
                <CircleCheck size={18} color={colors.brandPrimary} style={{ marginTop: 2 }} />
                <View className="flex-1">
                  <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                    {scanned.name}
                  </Text>
                  {scanned.brand && (
                    <Text className="text-xs" style={{ color: colors.textMuted }}>
                      {scanned.brand}
                    </Text>
                  )}
                </View>
              </View>
              <View>
                <FieldLabel>Amount (grams)</FieldLabel>
                <TextField keyboardType="numeric" value={grams} onChangeText={setGrams} />
              </View>
              <View className="flex-row gap-2">
                {[
                  { label: 'kcal', value: Math.round(scanned.caloriesPer100g * ((Number(grams) || 0) / 100)) },
                  { label: 'protein', value: `${Math.round(scanned.proteinPer100g * ((Number(grams) || 0) / 100))}g` },
                  { label: 'carbs', value: `${Math.round(scanned.carbsPer100g * ((Number(grams) || 0) / 100))}g` },
                  { label: 'fat', value: `${Math.round(scanned.fatPer100g * ((Number(grams) || 0) / 100))}g` },
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
              <View className="flex-row gap-2">
                <PressableScale hapticStyle="selection"
                  onPress={() => setMode('choose')}
                  className="flex-1 py-2.5 rounded-lg border items-center"
                  style={{ borderColor: colors.gridline }}
                >
                  <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                    Back
                  </Text>
                </PressableScale>
                <PressableScale hapticStyle="success" onPress={confirmScanned} className="flex-1 py-2.5 rounded-full items-center" style={{ backgroundColor: colors.brandPrimaryDark }}>
                  <Text className="text-white text-sm font-semibold">Add to log</Text>
                </PressableScale>
              </View>
            </View>
          )}

          {mode === 'manual' && (
            <View className="gap-3">
              <View>
                <FieldLabel>Food name</FieldLabel>
                <TextField
                  value={manual.name}
                  onChangeText={(name) => setManual((m) => ({ ...m, name }))}
                  placeholder="Grilled chicken breast"
                  autoFocus
                />
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <FieldLabel>Calories</FieldLabel>
                  <TextField keyboardType="numeric" value={manual.calories} onChangeText={(v) => setManual((m) => ({ ...m, calories: v }))} />
                </View>
                <View className="flex-1">
                  <FieldLabel>Servings</FieldLabel>
                  <TextField keyboardType="numeric" value={manual.quantity} onChangeText={(v) => setManual((m) => ({ ...m, quantity: v }))} />
                </View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <FieldLabel>Protein (g)</FieldLabel>
                  <TextField keyboardType="numeric" value={manual.proteinG} onChangeText={(v) => setManual((m) => ({ ...m, proteinG: v }))} />
                </View>
                <View className="flex-1">
                  <FieldLabel>Carbs (g)</FieldLabel>
                  <TextField keyboardType="numeric" value={manual.carbsG} onChangeText={(v) => setManual((m) => ({ ...m, carbsG: v }))} />
                </View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <FieldLabel>Fat (g)</FieldLabel>
                  <TextField keyboardType="numeric" value={manual.fatG} onChangeText={(v) => setManual((m) => ({ ...m, fatG: v }))} />
                </View>
                <View className="flex-1">
                  <FieldLabel>Serving label</FieldLabel>
                  <TextField value={manual.servingLabel} onChangeText={(v) => setManual((m) => ({ ...m, servingLabel: v }))} placeholder="1 cup" />
                </View>
              </View>
              <View className="flex-row gap-2 pt-1">
                <PressableScale hapticStyle="selection"
                  onPress={() => setMode('choose')}
                  className="flex-1 py-2.5 rounded-lg border items-center"
                  style={{ borderColor: colors.gridline }}
                >
                  <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                    Back
                  </Text>
                </PressableScale>
                <PressableScale hapticStyle="success" onPress={submitManual} className="flex-1 py-2.5 rounded-full items-center" style={{ backgroundColor: colors.brandPrimaryDark }}>
                  <Text className="text-white text-sm font-semibold">Add to log</Text>
                </PressableScale>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
