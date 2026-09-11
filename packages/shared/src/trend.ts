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

/**
 * Whole days between two YYYY-MM-DD dates.
 *
 * Date.parse reads a bare date string as UTC midnight, so the difference is exact and independent
 * of the device's timezone — the same reason addDaysISO does its arithmetic in UTC.
 */
export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86_400_000);
}
