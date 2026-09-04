import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection' | 'none';

/**
 * Fires a haptic, ignoring failures. Haptics are a nicety, never a dependency — on a device
 * with the Taptic Engine disabled, or on web, the call simply does nothing rather than
 * interrupting whatever action triggered it.
 */
export function haptic(style: HapticStyle = 'light') {
  if (style === 'none' || Platform.OS === 'web') return;
  try {
    switch (style) {
      case 'selection':
        void Haptics.selectionAsync();
        break;
      case 'success':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'medium':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      default:
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // Ignored — see above.
  }
}
