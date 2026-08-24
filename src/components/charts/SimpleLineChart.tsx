import { useState } from 'react';
import { parseISODate } from '../../lib/calc';
import { useContainerWidth } from './useContainerWidth';

export interface LinePoint {
  date: string;
  value: number;
}

const HEIGHT = 192; // matches the previous h-48 chart box
const PAD = { top: 10, right: 10, bottom: 24, left: 42 };

function formatDay(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const step = (max - min) / count;
  return Array.from({ length: count + 1 }, (_, i) => min + step * i);
}

/**
 * A small dependency-free line chart.
 *
 * Replaces recharts, which cost ~400 kB for a handful of simple trends — by far the largest
 * chunk in the app and the main reason the Progress page felt sluggish on a phone.
 */
export default function SimpleLineChart({
  data,
  unit = '',
  seriesLabel = 'Value',
  color = 'var(--series-2)',
  pad = 2,
}: {
  data: LinePoint[];
  unit?: string;
  seriesLabel?: string;
  color?: string;
  /** Head-room added above/below the data range, in data units. */
  pad?: number;
}) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const sorted = data.slice().sort((a, b) => a.date.localeCompare(b.date));

  const values = sorted.map((d) => d.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const min = rawMin - pad;
  const max = rawMax + pad === min ? min + 1 : rawMax + pad;

  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (sorted.length === 1 ? innerW / 2 : (innerW * i) / (sorted.length - 1));
  const y = (v: number) => PAD.top + innerH - ((v - min) / (max - min)) * innerH;

  const points = sorted.map((d, i) => ({ ...d, cx: x(i), cy: y(d.value) }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx},${p.cy}`).join(' ');
  const areaPath = points.length
    ? `${linePath} L${points[points.length - 1].cx},${PAD.top + innerH} L${points[0].cx},${PAD.top + innerH} Z`
    : '';

  const ticks = niceTicks(min, max);

  // Pick x-axis labels greedily left-to-right, keeping a minimum gap so they never overlap.
  // The last point is always labelled, and any earlier label crowding it is dropped.
  const MIN_LABEL_GAP = 58;
  const labelIndices: number[] = [];
  points.forEach((p, i) => {
    const last = labelIndices[labelIndices.length - 1];
    if (last == null || p.cx - points[last].cx >= MIN_LABEL_GAP) labelIndices.push(i);
  });
  if (points.length > 1) {
    const lastIdx = points.length - 1;
    while (
      labelIndices.length &&
      labelIndices[labelIndices.length - 1] !== lastIdx &&
      points[lastIdx].cx - points[labelIndices[labelIndices.length - 1]].cx < MIN_LABEL_GAP
    ) {
      labelIndices.pop();
    }
    if (labelIndices[labelIndices.length - 1] !== lastIdx) labelIndices.push(lastIdx);
  }

  function handlePointer(e: React.PointerEvent<SVGSVGElement>) {
    if (!points.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let nearest = 0;
    let best = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.cx - px);
      if (dist < best) {
        best = dist;
        nearest = i;
      }
    });
    setActiveIndex(nearest);
  }

  const active = activeIndex != null ? points[activeIndex] : null;

  return (
    <div ref={ref} className="relative" style={{ height: HEIGHT }}>
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${seriesLabel} trend`}
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={() => setActiveIndex(null)}
          style={{ touchAction: 'pan-y' }}
        >
          {ticks.map((t, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--gridline)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(t) + 4}
                textAnchor="end"
                fontSize={11}
                fill="var(--text-muted)"
              >
                {Math.round(t * 10) / 10}
              </text>
            </g>
          ))}

          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={PAD.top + innerH}
            y2={PAD.top + innerH}
            stroke="var(--baseline)"
            strokeWidth={1}
          />

          <path d={areaPath} fill={color} opacity={0.09} />
          <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.cx}
              cy={p.cy}
              r={activeIndex === i ? 5 : 3}
              fill={color}
              stroke="var(--chart-surface)"
              strokeWidth={activeIndex === i ? 2 : 0}
            />
          ))}

          {labelIndices.map((i) => (
            <text
              key={`l${i}`}
              x={points[i].cx}
              y={HEIGHT - 6}
              textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
              fontSize={11}
              fill="var(--text-muted)"
            >
              {formatDay(points[i].date)}
            </text>
          ))}
        </svg>
      )}

      {active && (
        <div
          className="absolute pointer-events-none rounded-lg px-2 py-1 text-xs whitespace-nowrap"
          style={{
            left: Math.min(Math.max(active.cx - 40, 0), Math.max(0, width - 96)),
            top: Math.max(0, active.cy - 44),
            background: 'var(--chart-surface)',
            border: '1px solid var(--gridline)',
            color: 'var(--text-primary)',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>{formatDay(active.date)}: </span>
          {Math.round(active.value * 10) / 10}
          {unit ? ` ${unit}` : ''}
        </div>
      )}
    </div>
  );
}
