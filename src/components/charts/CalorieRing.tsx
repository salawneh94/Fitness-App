export default function CalorieRing({
  consumed,
  target,
  burned = 0,
}: {
  consumed: number;
  target: number;
  burned?: number;
}) {
  const remaining = Math.max(0, target - consumed + burned);
  const pct = target > 0 ? Math.min(1, consumed / target) : 0;
  const size = 160;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  const over = consumed > target;

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--gridline)" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={over ? 'var(--status-warning)' : 'var(--series-1)'}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {Math.round(remaining)}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {over ? 'over target' : 'kcal left'}
          </span>
        </div>
      </div>
      <dl className="text-sm space-y-1.5">
        <div className="flex justify-between gap-4">
          <dt style={{ color: 'var(--text-secondary)' }}>Target</dt>
          <dd className="font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>{target} kcal</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt style={{ color: 'var(--text-secondary)' }}>Consumed</dt>
          <dd className="font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>{Math.round(consumed)} kcal</dd>
        </div>
        {burned > 0 && (
          <div className="flex justify-between gap-4">
            <dt style={{ color: 'var(--text-secondary)' }}>Burned (exercise)</dt>
            <dd className="font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>+{Math.round(burned)} kcal</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
