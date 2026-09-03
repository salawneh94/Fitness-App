import { useCountUp } from '@/hooks/use-count-up';

/** Renders an animated number. Must be used as a <Text> child (returns a string, not an element). */
export default function CountUp({
  value,
  decimals = 0,
  duration,
  prefix = '',
  suffix = '',
  formatter,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  formatter?: (n: number) => string;
}) {
  const display = useCountUp(value, duration);

  if (!Number.isFinite(display)) return formatter ? formatter(value) : `${prefix}${value}${suffix}`;

  return formatter
    ? formatter(display)
    : `${prefix}${display.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
}
