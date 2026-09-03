/**
 * FitTrack's dark-navy/electric-cyan/gold palette, shared between the web app
 * (apps/web/src/index.css) and the mobile app (which has no CSS custom
 * properties, so these are plain values consumed directly or via NativeWind
 * arbitrary-value classes like `bg-[${colors.background}]`).
 */
export const colors = {
  background: '#0a0e17',
  chartSurface: '#141b2c',

  textPrimary: '#f2f5fa',
  textSecondary: '#aab4c8',
  textMuted: '#8a95ab',

  gridline: '#2a3854',
  baseline: '#3a4a6b',

  // Chart series colors — validated categorical palette, never repurposed as
  // brand/decorative colors.
  series1: '#3987e5', // blue
  series2: '#eb6834', // orange
  series3: '#1baf7a', // aqua
  series4: '#eda100', // yellow

  statusGood: '#22c55e',
  statusWarning: '#fbbf24',
  statusSerious: '#f0975e',
  statusCritical: '#ef4444',

  // Brand accents — decorative UI (buttons, rings, badges, logo) only, never
  // used for chart series/status.
  brandPrimary: '#22d3ee',
  brandPrimaryDark: '#0e7490',
  brandLime: '#fbbf24',
  brandLimeDark: '#b45309',
} as const;

export type ThemeColors = typeof colors;
