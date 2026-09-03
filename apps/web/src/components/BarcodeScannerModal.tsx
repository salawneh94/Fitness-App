import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X } from 'lucide-react';

const SCANNER_ELEMENT_ID = 'barcode-scanner-region';

export default function BarcodeScannerModal({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          if (stoppedRef.current) return;
          stoppedRef.current = true;
          scanner
            .stop()
            .catch(() => {})
            .finally(() => onDetected(decodedText));
        },
        () => {
          // ignore per-frame decode errors — expected while camera is searching
        }
      )
      .catch((err) => {
        console.error('Camera start failed', err);
      });

    return () => {
      if (!stoppedRef.current) {
        stoppedRef.current = true;
        scanner.stop().catch(() => {});
      }
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 w-full max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Scan Barcode</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div id={SCANNER_ELEMENT_ID} className="rounded-xl overflow-hidden bg-black" />
        <p className="text-xs mt-3 text-center" style={{ color: 'var(--text-muted)' }}>
          Point your camera at a product barcode. Requires camera permission.
        </p>
      </div>
    </div>
  );
}
