import { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { parseISODate } from '@fittrack/shared';
import { colors } from '@fittrack/shared';

export interface LinePoint {
  date: string;
  value: number;
}

const HEIGHT = 192;
const PAD = { top: 10, right: 10, bottom: 24, left: 42 };

function formatDay(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const step = (max - min) / count;
  return Array.from({ length: count + 1 }, (_, i) => min + step * i);
}

/** A small dependency-free line chart, drawn with react-native-svg — the RN port of the web app's SimpleLineChart. */
export default function SimpleLineChart({
  data,
  unit = '',
  seriesLabel = 'Value',
  color = colors.series2,
  pad = 2,
}: {
  data: LinePoint[];
  unit?: string;
  seriesLabel?: string;
  color?: string;
  pad?: number;
}) {
  const [width, setWidth] = useState(0);

  function onLayout(e: LayoutChangeEvent) {
    const next = e.nativeEvent.layout.width;
    setWidth((prev) => (Math.abs(prev - next) > 1 ? next : prev));
  }

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

  const latest = points[points.length - 1] ?? null;

  return (
    <View onLayout={onLayout} style={{ height: HEIGHT }}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          {ticks.map((t, i) => (
            <G key={i}>
              <Line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={colors.gridline} strokeWidth={1} />
              <SvgText x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill={colors.textMuted}>
                {Math.round(t * 10) / 10}
              </SvgText>
            </G>
          ))}

          <Line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke={colors.baseline} strokeWidth={1} />

          <Path d={areaPath} fill={color} opacity={0.09} />
          <Path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          {points.map((p, i) => (
            <Circle
              key={i}
              cx={p.cx}
              cy={p.cy}
              r={p === latest ? 5 : 3}
              fill={color}
              stroke={colors.chartSurface}
              strokeWidth={p === latest ? 2 : 0}
            />
          ))}

          {labelIndices.map((i) => (
            <SvgText
              key={`l${i}`}
              x={points[i].cx}
              y={HEIGHT - 6}
              textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
              fontSize={11}
              fill={colors.textMuted}
            >
              {formatDay(points[i].date)}
            </SvgText>
          ))}
        </Svg>
      )}
    </View>
  );
}
