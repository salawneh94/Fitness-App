import * as Sentry from '@sentry/react-native';

/**
 * Crash reporting, off until a DSN is configured.
 *
 * The error boundary shows the user a recoverable screen and tells nobody — so a screen that
 * crashes for some slice of users on some OS version is invisible to us until someone bothers
 * to leave a one-star review explaining it. That is a bad way to find out about a bug in an app
 * people pay for.
 *
 * Same shape as the Supabase and RevenueCat clients: read the key from the environment, and no-op
 * cleanly when it's absent so the app runs fine without one. Nothing here is verified against a
 * live Sentry project yet — the DSN belongs to an account that doesn't exist at time of writing.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const crashReportingEnabled = Boolean(dsn);

export function initCrashReporting(): void {
  if (!dsn) return;

  Sentry.init({
    dsn,
    // A fitness log is personal. Sentry's default already excludes request bodies, but turning
    // this off explicitly means a future SDK change can't start attaching IPs and usernames
    // without someone deciding to.
    sendDefaultPii: false,
    // Performance tracing costs quota and answers questions nobody is asking yet. Crashes are
    // the point; sampling can be raised when there's a reason to.
    tracesSampleRate: 0,
    environment: __DEV__ ? 'development' : 'production',
  });
}

/**
 * Report an error that was handled rather than thrown — the crash screen uses this, so a caught
 * render failure still reaches Sentry instead of only reaching the user.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!dsn) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
