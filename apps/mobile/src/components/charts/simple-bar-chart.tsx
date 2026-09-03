import { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '@fittrack/shared';

export interface BarPoint {
  label: string;
  value: number;
}

const HEIGHT = 192;
const PAD = { top: 10, right: 10, bottom: 24, left: 42 };

/** A small dependency-free bar chart with an optional target line — the RN port of the web app's SimpleBarChart. */
export default function SimpleBarChart({
  data,
  referenceValue,
  referenceLabel,
  color = colors.series1,
}: {
  data: BarPoint[];
  referenceValue?: number;
  referenceLabel?: string;
  color?: string;
  unit?: string;
}) {
  const [width, setWidth] = useState(0);

  function onLayout(e: LayoutChangeEvent) {
    const next = e.nativeEvent.layout.width;
    setWidth((prev) => (Math.abs(prev - next) > 1 ? next : prev));
  }

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
    <View onLayout={onLayout} style={{ height: HEIGHT }}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          {ticks.map((t, i) => (
            <G key={i}>
              <Line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={colors.gridline} strokeWidth={1} />
              <SvgText x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill={colors.textMuted}>
                {Math.round(t)}
              </SvgText>
            </G>
          ))}

          {data.map((d, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const barH = Math.max(0, PAD.top + innerH - y(d.value));
            return (
              <Rect
                key={i}
                x={cx - barW / 2}
                y={y(d.value)}
                width={barW}
                height={barH}
                rx={Math.min(4, barW / 2)}
                fill={color}
              />
            );
          })}

          {referenceValue != null && (
            <>
              <Line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(referenceValue)}
                y2={y(referenceValue)}
                stroke={colors.series2}
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              {referenceLabel && (
                <SvgText x={width - PAD.right} y={y(referenceValue) - 5} textAnchor="end" fontSize={10} fontWeight={600} fill={colors.series2}>
                  {referenceLabel}
                </SvgText>
              )}
            </>
          )}

          <Line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke={colors.baseline} strokeWidth={1} />

          {data.map((d, i) =>
            i % labelStep === 0 || i === data.length - 1 ? (
              <SvgText key={`l${i}`} x={PAD.left + slot * i + slot / 2} y={HEIGHT - 6} textAnchor="middle" fontSize={11} fill={colors.textMuted}>
                {d.label}
              </SvgText>
            ) : null
          )}
        </Svg>
      )}
    </View>
  );
}
