import { useState } from 'react';
import { Alert, Linking, Platform, Switch, Text, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { colors } from '@fittrack/shared';
import { useReminderStore } from '@/store/useReminderStore';
import Card from './ui/card';
import PressableScale from '@/components/ui/pressable-scale';

/** Evening slots people actually pick — a full time picker is more control than this needs. */
const TIME_OPTIONS = [
  { hour: 18, minute: 0, label: '6:00 PM' },
  { hour: 20, minute: 0, label: '8:00 PM' },
  { hour: 21, minute: 30, label: '9:30 PM' },
];

export default function ReminderCard() {
  const enabled = useReminderStore((s) => s.enabled);
  const hour = useReminderStore((s) => s.hour);
  const minute = useReminderStore((s) => s.minute);
  const setEnabled = useReminderStore((s) => s.setEnabled);
  const setTime = useReminderStore((s) => s.setTime);
  const [busy, setBusy] = useState(false);

  if (Platform.OS === 'web') return null; // no local notifications in a browser tab

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      const result = await setEnabled(next);
      // Asking and being refused is the one case worth explaining — the switch springing back
      // with no reason looks like a bug rather than an OS decision.
      if (next && !result) {
        Alert.alert(
          'Notifications are off',
          'FitTrack needs notification permission to remind you. You can turn it on in Settings.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => void Linking.openSettings() },
          ]
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Daily reminder">
      <View className="flex-row items-start gap-3">
        <Bell size={18} color={enabled ? colors.brandPrimary : colors.textMuted} style={{ marginTop: 2 }} />
        <View className="flex-1">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-sm font-medium flex-1" style={{ color: colors.textPrimary }}>
              Remind me if I haven't logged
            </Text>
            <Switch
              value={enabled}
              onValueChange={(v) => void toggle(v)}
              disabled={busy}
              accessibilityLabel="Daily reminder"
              trackColor={{ false: colors.gridline, true: colors.brandPrimaryDark }}
            />
          </View>
          <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
            Only sent on days you haven't logged anything — never as a daily nag.
          </Text>

          {enabled && (
            <View className="flex-row flex-wrap gap-1.5 mt-3">
              {TIME_OPTIONS.map((t) => {
                const selected = t.hour === hour && t.minute === minute;
                return (
                  <PressableScale
                    key={t.label}
                    hapticStyle="selection"
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Remind me at ${t.label}`}
                    onPress={() => void setTime(t.hour, t.minute)}
                    className="px-3 py-1.5 rounded-full border"
                    style={{
                      backgroundColor: selected ? colors.brandPrimaryDark : 'transparent',
                      borderColor: selected ? colors.brandPrimaryDark : colors.gridline,
                    }}
                  >
                    <Text className="text-xs font-medium" style={{ color: selected ? 'white' : colors.textSecondary }}>
                      {t.label}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </Card>
  );
}
