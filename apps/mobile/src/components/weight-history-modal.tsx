import { useMemo, useState } from 'react';
import { Pencil, Trash2, X } from 'lucide-react-native';
import { FlatList, Modal, Text, View } from 'react-native';
import type { WeightEntry } from '@fittrack/shared';
import { checkWeighIn, colors, displayWeight, parseISODate, weightUnitLabel } from '@fittrack/shared';
import { useAppStore } from '@/store/useAppStore';
import { weighInMessage } from '@/lib/entry-messages';
import WeightInput from './ui/weight-input';
import PressableScale from './ui/pressable-scale';
import UndoToast from './ui/undo-toast';

/**
 * Every weigh-in, newest first, each one correctable.
 *
 * Until now a weigh-in could only ever be added. A typo — 850 for 85 — became "your weight",
 * reset every calorie target, and stayed in every trend the app fits for good; the only way out
 * was to overwrite that one day, and only if you could still reach it.
 */
export default function WeightHistoryModal({ onClose }: { onClose: () => void }) {
  const weightHistory = useAppStore((s) => s.weightHistory);
  const unit = useAppStore((s) => s.profile?.unitSystem ?? 'metric');
  const updateWeight = useAppStore((s) => s.updateWeight);
  const removeWeight = useAppStore((s) => s.removeWeight);

  const [editing, setEditing] = useState<string | null>(null);
  const [undo, setUndo] = useState<WeightEntry | null>(null);

  const rows = useMemo(() => [...weightHistory].sort((a, b) => b.date.localeCompare(a.date)), [weightHistory]);
  const fmt = (kg: number) => `${(Math.round(displayWeight(kg, unit) * 10) / 10).toFixed(1)}`;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
          <View>
            <Text className="font-semibold" style={{ color: colors.textPrimary }}>
              Weigh-ins
            </Text>
            <Text className="text-xs" style={{ color: colors.textMuted }}>
              Tap one to correct it.
            </Text>
          </View>
          <PressableScale accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} className="p-1">
            <X size={18} color={colors.textPrimary} />
          </PressableScale>
        </View>

        <FlatList
          data={rows}
          keyExtractor={(w) => w.date}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 96 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text className="text-sm py-6" style={{ color: colors.textMuted }}>
              No weigh-ins yet. Log one from the Overview screen.
            </Text>
          }
          renderItem={({ item, index }) => {
            // The change since the reading before it — the list is newest first, so that's the next row.
            const before = rows[index + 1];
            const change = before ? item.weightKg - before.weightKg : null;
            const day = parseISODate(item.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
            if (editing === item.date) {
              return (
                <EditRow
                  entry={item}
                  history={weightHistory}
                  dayLabel={day}
                  onCancel={() => setEditing(null)}
                  onSave={(kg) => {
                    updateWeight(kg, item.date);
                    setEditing(null);
                  }}
                />
              );
            }
            return (
              <View className="flex-row items-center gap-3 py-3 border-b" style={{ borderColor: colors.gridline }}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`Edit weigh-in on ${day}`}
                  onPress={() => setEditing(item.date)}
                  className="flex-1 flex-row items-center justify-between gap-3"
                >
                  <Text className="text-sm" style={{ color: colors.textSecondary }}>
                    {day}
                  </Text>
                  <View className="flex-row items-baseline gap-2">
                    {change !== null && Math.abs(change) >= 0.05 && (
                      <Text className="text-xs" style={{ color: colors.textMuted }}>
                        {change > 0 ? '+' : '−'}
                        {fmt(Math.abs(change))}
                      </Text>
                    )}
                    <Text className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                      {fmt(item.weightKg)} {weightUnitLabel(unit)}
                    </Text>
                    <Pencil size={13} color={colors.textMuted} />
                  </View>
                </PressableScale>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`Delete weigh-in on ${day}`}
                  hapticStyle="warning"
                  onPress={() => {
                    removeWeight(item.date);
                    setUndo(item);
                  }}
                  className="p-1.5"
                >
                  <Trash2 size={15} color={colors.textMuted} />
                </PressableScale>
              </View>
            );
          }}
        />

        {undo && (
          <UndoToast
            key={undo.date}
            message={`Deleted ${fmt(undo.weightKg)} ${weightUnitLabel(unit)} on ${parseISODate(undo.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
            onUndo={() => updateWeight(undo.weightKg, undo.date)}
            onDone={() => setUndo(null)}
          />
        )}
      </View>
    </Modal>
  );
}

function EditRow({
  entry,
  history,
  dayLabel,
  onCancel,
  onSave,
}: {
  entry: WeightEntry;
  history: WeightEntry[];
  dayLabel: string;
  onCancel: () => void;
  onSave: (kg: number) => void;
}) {
  const unit = useAppStore((s) => s.profile?.unitSystem ?? 'metric');
  const [kg, setKg] = useState<number | ''>(entry.weightKg);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function save() {
    if (kg === '') return;
    const check = checkWeighIn(kg, entry.date, history);
    if (check.kind === 'invalid' || (check.kind === 'unusual' && !confirming)) {
      setProblem(weighInMessage(check, unit));
      setConfirming(check.kind === 'unusual');
      return;
    }
    onSave(kg);
  }

  return (
    <View className="py-3 border-b" style={{ borderColor: colors.gridline }}>
      <Text className="text-sm mb-2" style={{ color: colors.textSecondary }}>
        {dayLabel}
      </Text>
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <WeightInput
            valueKg={kg}
            onChangeKg={(v) => {
              setKg(v);
              setProblem(null);
              setConfirming(false);
            }}
            unit={unit}
            accessibilityLabel={`Weight on ${dayLabel}`}
          />
        </View>
        <PressableScale accessibilityRole="button" onPress={onCancel} className="px-3 py-2">
          <Text className="text-sm" style={{ color: colors.textSecondary }}>
            Cancel
          </Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          hapticStyle="success"
          onPress={save}
          disabled={kg === ''}
          className="px-4 py-2 rounded-full"
          style={{ backgroundColor: colors.brandPrimaryDark, opacity: kg === '' ? 0.5 : 1 }}
        >
          <Text className="text-white text-sm font-semibold">{confirming ? 'Save anyway' : 'Save'}</Text>
        </PressableScale>
      </View>
      {problem && (
        <Text className="text-xs mt-2" style={{ color: colors.statusWarning }} accessibilityLiveRegion="polite">
          {problem}
        </Text>
      )}
    </View>
  );
}
