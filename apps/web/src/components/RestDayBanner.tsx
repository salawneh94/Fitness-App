import { AlertTriangle } from 'lucide-react';

export default function RestDayBanner({ consecutiveDays }: { consecutiveDays: number }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
      <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {consecutiveDays} days trained in a row — consider a rest day
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          Recovery is when muscles actually rebuild stronger. A day off (or light active recovery) now can help prevent injury and burnout.
        </p>
      </div>
    </div>
  );
}
