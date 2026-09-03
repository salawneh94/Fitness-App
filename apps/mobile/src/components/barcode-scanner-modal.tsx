import { useRef } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { colors } from '@fittrack/shared';

export default function BarcodeScannerModal({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  function handleScan(code: string) {
    if (scannedRef.current) return;
    scannedRef.current = true;
    onDetected(code);
  }

  if (!permission) {
    return (
      <View className="p-5 items-center">
        <Text style={{ color: colors.textMuted }}>Checking camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="p-5 items-center gap-4">
        <Text className="text-sm text-center" style={{ color: colors.textSecondary }}>
          FitTrack needs camera access to scan barcodes.
        </Text>
        <Pressable
          onPress={requestPermission}
          className="px-4 py-2.5 rounded-full"
          style={{ backgroundColor: colors.brandPrimaryDark }}
        >
          <Text className="text-white text-sm font-semibold">Grant camera access</Text>
        </Pressable>
        <Pressable onPress={onClose}>
          <Text className="text-sm" style={{ color: colors.textMuted }}>
            Cancel
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="p-5">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="font-semibold" style={{ color: colors.textPrimary }}>
          Scan Barcode
        </Text>
        <Pressable onPress={onClose} className="p-1">
          <X size={18} color={colors.textPrimary} />
        </Pressable>
      </View>
      <View className="rounded-xl overflow-hidden bg-black" style={{ height: 280 }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }}
          onBarcodeScanned={(result) => handleScan(result.data)}
        />
      </View>
      <Text className="text-xs mt-3 text-center" style={{ color: colors.textMuted }}>
        Point your camera at a product barcode.
      </Text>
    </View>
  );
}
