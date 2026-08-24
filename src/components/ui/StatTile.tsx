import type { LucideIcon } from 'lucide-react';

export default function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  accent = 'var(--series-1)',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 flex items-start gap-4 shadow-sm shadow-gray-200/50 dark:shadow-none">
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
        style={{ background: `color-mix(in srgb, ${accent} 18%, transparent)`, color: accent }}
      >
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
        {/* Not truncated: this is the headline number, and clipping it to something like "10…"
            is worse than letting it size down. Slightly smaller on narrow screens so two tiles
            still fit side by side. */}
        <p className="text-xl sm:text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
      </div>
    </div>
  );
}
