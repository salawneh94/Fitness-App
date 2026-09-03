interface MacroRow {
  label: string;
  consumed: number;
  target: number;
  unit: string;
  color: string;
}

function Bar({ row }: { row: MacroRow }) {
  const pct = row.target > 0 ? Math.min(1, row.consumed / row.target) : 0;
  const over = row.consumed > row.target;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: row.color }} />
          {row.label}
        </span>
        <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
          {Math.round(row.consumed)} / {Math.round(row.target)} {row.unit}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--gridline)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct * 100}%`,
            background: over ? 'var(--status-warning)' : row.color,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  );
}

export default function MacroBars({
  protein,
  carbs,
  fat,
}: {
  protein: { consumed: number; target: number };
  carbs: { consumed: number; target: number };
  fat: { consumed: number; target: number };
}) {
  const rows: MacroRow[] = [
    { label: 'Protein', unit: 'g', color: 'var(--series-1)', ...protein },
    { label: 'Carbs', unit: 'g', color: 'var(--series-2)', ...carbs },
    { label: 'Fat', unit: 'g', color: 'var(--series-3)', ...fat },
  ];
  return (
    <div className="space-y-3.5">
      {rows.map((r) => (
        <Bar key={r.label} row={r} />
      ))}
    </div>
  );
}
