import SimpleLineChart from './SimpleLineChart';

export default function LineTrendChart({
  data,
  unit = '',
  seriesLabel = 'Value',
  color = 'var(--series-2)',
  emptyMessage = 'Log a few entries on different days to see your trend here.',
}: {
  data: { date: string; value: number }[];
  unit?: string;
  seriesLabel?: string;
  color?: string;
  emptyMessage?: string;
}) {
  if (data.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-center px-4" style={{ color: 'var(--text-muted)' }}>
        {emptyMessage}
      </div>
    );
  }

  return <SimpleLineChart data={data} unit={unit} seriesLabel={seriesLabel} color={color} pad={2} />;
}
