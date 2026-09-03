import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useAppStore } from '@/store/useAppStore';
import type { SavedMealItem } from '@fittrack/shared';
import { colors } from '@fittrack/shared';
import TextField from './ui/text-field';

const emptyItem: SavedMealItem = { name: '', calories: 0, proteinG: 0, carbsG: 0, fatG: 0, quantity: 1, servingLabel: 'serving' };

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-xs font-medium mb-1" style={{ color: colors.textSecondary }}>
      {children}
    </Text>
  );
}

export default function SavedMealBuilderModal({ onClose }: { onClose: () => void }) {
  const addSavedMeal = useAppStore((s) => s.addSavedMeal);
  const [mealName, setMealName] = useState('');
  const [items, setItems] = useState<SavedMealItem[]>([]);
  const [draft, setDraft] = useState(emptyItem);

  function addItem() {
    if (!draft.name.trim()) return;
    setItems((prev) => [...prev, { ...draft, name: draft.name.trim() }]);
    setDraft(emptyItem);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function save() {
    if (!mealName.trim() || items.length === 0) return;
    addSavedMeal(mealName.trim(), items);
    onClose();
  }

  const totalCalories = items.reduce((s, i) => s + i.calories * i.quantity, 0);
  const canSave = mealName.trim().length > 0 && items.length > 0;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <ScrollView className="flex-1 p-5" keyboardShouldPersistTaps="handled">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="font-semibold" style={{ color: colors.textPrimary }}>
              New Saved Meal
            </Text>
            <Pressable onPress={onClose} className="p-1">
              <X size={18} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View className="mb-4">
            <FieldLabel>Meal name</FieldLabel>
            <TextField value={mealName} onChangeText={setMealName} placeholder="My usual breakfast" />
          </View>

          {items.length > 0 && (
            <View className="mb-4">
              {items.map((item, idx) => (
                <View
                  key={idx}
                  className="flex-row items-center justify-between py-2 border-b"
                  style={{ borderColor: colors.gridline }}
                >
                  <View className="flex-1 min-w-0">
                    <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                      {item.name}
                    </Text>
                    <Text className="text-xs" style={{ color: colors.textMuted }}>
                      {item.quantity} × {item.servingLabel} · {Math.round(item.calories * item.quantity)} kcal
                    </Text>
                  </View>
                  <Pressable onPress={() => removeItem(idx)} className="p-1.5">
                    <Trash2 size={15} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}
              <View className="pt-2 flex-row justify-between">
                <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                  Total
                </Text>
                <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                  {Math.round(totalCalories)} kcal
                </Text>
              </View>
            </View>
          )}

          <View className="rounded-xl border p-3 mb-4" style={{ borderColor: colors.gridline }}>
            <Text className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.textMuted }}>
              Add item
            </Text>
            <View className="gap-2">
              <TextField placeholder="Food name" value={draft.name} onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))} />
              <View className="flex-row gap-2">
                <TextField
                  className="flex-1"
                  keyboardType="numeric"
                  placeholder="kcal"
                  value={draft.calories ? String(draft.calories) : ''}
                  onChangeText={(v) => setDraft((d) => ({ ...d, calories: Number(v) || 0 }))}
                />
                <TextField
                  className="flex-1"
                  keyboardType="numeric"
                  placeholder="protein g"
                  value={draft.proteinG ? String(draft.proteinG) : ''}
                  onChangeText={(v) => setDraft((d) => ({ ...d, proteinG: Number(v) || 0 }))}
                />
              </View>
              <View className="flex-row gap-2">
                <TextField
                  className="flex-1"
                  keyboardType="numeric"
                  placeholder="carbs g"
                  value={draft.carbsG ? String(draft.carbsG) : ''}
                  onChangeText={(v) => setDraft((d) => ({ ...d, carbsG: Number(v) || 0 }))}
                />
                <TextField
                  className="flex-1"
                  keyboardType="numeric"
                  placeholder="fat g"
                  value={draft.fatG ? String(draft.fatG) : ''}
                  onChangeText={(v) => setDraft((d) => ({ ...d, fatG: Number(v) || 0 }))}
                />
              </View>
              <View className="flex-row gap-2">
                <TextField
                  className="flex-1"
                  keyboardType="numeric"
                  placeholder="servings"
                  value={String(draft.quantity)}
                  onChangeText={(v) => setDraft((d) => ({ ...d, quantity: Number(v) || 0 }))}
                />
                <TextField
                  className="flex-1"
                  placeholder="serving label"
                  value={draft.servingLabel}
                  onChangeText={(v) => setDraft((d) => ({ ...d, servingLabel: v }))}
                />
              </View>
              <Pressable
                onPress={addItem}
                className="flex-row items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed"
                style={{ borderColor: colors.gridline }}
              >
                <Plus size={15} color={colors.brandPrimary} />
                <Text className="text-sm font-medium" style={{ color: colors.brandPrimary }}>
                  Add item to meal
                </Text>
              </Pressable>
            </View>
          </View>

          <View className="flex-row gap-2">
            <Pressable onPress={onClose} className="flex-1 py-2.5 rounded-lg border items-center" style={{ borderColor: colors.gridline }}>
              <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={save}
              disabled={!canSave}
              className="flex-1 py-2.5 rounded-full items-center"
              style={{ backgroundColor: colors.brandPrimaryDark, opacity: canSave ? 1 : 0.4 }}
            >
              <Text className="text-white text-sm font-semibold">Save Meal</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
