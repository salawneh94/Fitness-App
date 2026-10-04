/**
 * Least-squares slope of a series against day offset, per day.
 *
 * Shared by the adaptive-TDEE measurement and the insight engine, which both need to answer
 * "which way is this actually going?" from noisy daily readings. Endpoint-to-endpoint is not a
 * substitute: bodyweight swings 1–2kg on water and glycogen alone, which dwarfs the ~0.25kg/week
 * a plan aims for, so whichever two days sit at the ends would decide the answer.
 *
 * Returns null when there is nothing to fit — fewer than two points, or every reading on the same
 * day, where a slope is undefined rather than zero.
 */
export function slopePerDay(points: { dayOffset: number; value: number }[]): number | null {
  if (points.length < 2) return null;

  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.dayOffset, 0) / n;
  const meanY = points.reduce((s, p) => s + p.value, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (const p of points) {
    const dx = p.dayOffset - meanX;
    numerator += dx * (p.value - meanY);
    denominator += dx * dx;
  }
  return denominator === 0 ? null : numerator / denominator;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * A line through the series that one odd reading can't drag: the Theil–Sen estimator, whose slope
 * is the median of the slopes between every pair of points and whose intercept is the median
 * residual.
 *
 * Least squares weights the newest reading heavily, because it sits at the end of the range — so
 * one salty dinner the night before a weigh-in can move a goal date by two months, and back again
 * the day after. A median simply ignores it. Used where a number is shown to the user daily and
 * must not jump about; null where slopePerDay would be.
 */
export function robustLine(points: { dayOffset: number; value: number }[]): { slopePerDay: number; intercept: number } | null {
  const slopes: number[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[j].dayOffset - points[i].dayOffset;
      if (dx !== 0) slopes.push((points[j].value - points[i].value) / dx);
    }
  }
  if (slopes.length === 0) return null;
  const slope = median(slopes);
  return { slopePerDay: slope, intercept: median(points.map((p) => p.value - slope * p.dayOffset)) };
}

/**
 * Whole days between two YYYY-MM-DD dates.
 *
 * Date.parse reads a bare date string as UTC midnight, so the difference is exact and independent
 * of the device's timezone — the same reason addDaysISO does its arithmetic in UTC.
 */
export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86_400_000);
}
