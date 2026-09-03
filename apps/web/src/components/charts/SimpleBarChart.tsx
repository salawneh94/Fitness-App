import { useState } from 'react';
import { useContainerWidth } from './useContainerWidth';

export interface BarPoint {
  label: string;
  value: number;
}

const HEIGHT = 192;
const PAD = { top: 10, right: 10, bottom: 24, left: 42 };

/**
 * A small dependency-free bar chart with an optional target line — the recharts replacement
 * for the calorie trend. See SimpleLineChart for why recharts was dropped.
 */
export default function SimpleBarChart({
  data,
  referenceValue,
  referenceLabel,
  color = 'var(--series-1)',
  unit = '',
}: {
  data: BarPoint[];
  referenceValue?: number;
  referenceLabel?: string;
  color?: string;
  unit?: string;
}) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const maxValue = Math.max(...data.map((d) => d.value), referenceValue ?? 0, 1);
  const top = maxValue * 1.1;

  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const slot = data.length ? innerW / data.length : 0;
  const barW = Math.max(4, Math.min(28, slot * 0.6));
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;

  const ticks = [0, top / 2, top];

  const maxLabels = Math.max(2, Math.floor(innerW / 40));
  const labelStep = Math.ceil(data.length / maxLabels);

  return (
    <div ref={ref} className="relative" style={{ height: HEIGHT }}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label="Calorie trend">
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--gridline)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">
                {Math.round(t)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const barH = Math.max(0, PAD.top + innerH - y(d.value));
            return (
              <g key={i} onPointerEnter={() => setActiveIndex(i)} onPointerLeave={() => setActiveIndex(null)}>
                {/* Full-height hit area so short bars stay easy to tap. */}
                <rect x={cx - slot / 2} y={PAD.top} width={slot} height={innerH} fill="transparent" />
                <rect
                  x={cx - barW / 2}
                  y={y(d.value)}
                  width={barW}
                  height={barH}
                  rx={Math.min(4, barW / 2)}
                  fill={color}
                  opacity={activeIndex == null || activeIndex === i ? 1 : 0.45}
                />
              </g>
            );
          })}

          {referenceValue != null && (
            <>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(referenceValue)}
                y2={y(referenceValue)}
                stroke="var(--series-2)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              {referenceLabel && (
                <text
                  x={width - PAD.right}
                  y={y(referenceValue) - 5}
                  textAnchor="end"
                  fontSize={10}
                  fontWeight={600}
                  fill="var(--series-2)"
                >
                  {referenceLabel}
                </text>
              )}
            </>
          )}

          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={PAD.top + innerH}
            y2={PAD.top + innerH}
            stroke="var(--baseline)"
            strokeWidth={1}
          />

          {data.map((d, i) =>
            i % labelStep === 0 || i === data.length - 1 ? (
              <text
                key={`l${i}`}
                x={PAD.left + slot * i + slot / 2}
                y={HEIGHT - 6}
                textAnchor="middle"
                fontSize={11}
                fill="var(--text-muted)"
              >
                {d.label}
              </text>
            ) : null
          )}
        </svg>
      )}

      {activeIndex != null && data[activeIndex] && (
        <div
          className="absolute pointer-events-none rounded-lg px-2 py-1 text-xs whitespace-nowrap"
          style={{
            left: Math.min(Math.max(PAD.left + slot * activeIndex + slot / 2 - 40, 0), Math.max(0, width - 96)),
            top: Math.max(0, y(data[activeIndex].value) - 34),
            background: 'var(--chart-surface)',
            border: '1px solid var(--gridline)',
            color: 'var(--text-primary)',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>{data[activeIndex].label}: </span>
          {Math.round(data[activeIndex].value)}
          {unit ? ` ${unit}` : ''}
        </div>
      )}
    </div>
  );
}
