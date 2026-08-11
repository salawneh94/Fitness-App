import RingGauge from './RingGauge';

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
  const over = consumed > target;

  return (
    <div className="flex items-center gap-6">
      <RingGauge
        value={consumed}
        target={target}
        centerValue={`${Math.round(remaining)}`}
        centerLabel={over ? 'over target' : 'kcal left'}
      />
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
