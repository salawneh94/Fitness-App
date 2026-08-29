import type { ReactNode } from 'react';

export default function RingGauge({
  value,
  target,
  color = 'var(--brand-primary)',
  overColor = 'var(--status-warning)',
  size = 160,
  stroke = 14,
  centerValue,
  centerLabel,
  allowOverTarget = true,
}: {
  value: number;
  target: number;
  color?: string;
  overColor?: string;
  size?: number;
  stroke?: number;
  centerValue: ReactNode;
  centerLabel: string;
  allowOverTarget?: boolean;
}) {
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  const over = allowOverTarget && value > target;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--gridline)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? overColor : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.6s cubic-bezier(.22,.9,.3,1), stroke 0.3s ease',
            filter: `drop-shadow(0 0 6px color-mix(in srgb, ${over ? overColor : color} 55%, transparent))`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {centerValue}
        </span>
        <span className="text-xs text-center px-2" style={{ color: 'var(--text-muted)' }}>
          {centerLabel}
        </span>
      </div>
    </div>
  );
}
