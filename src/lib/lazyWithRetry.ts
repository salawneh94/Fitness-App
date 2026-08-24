import { lazy, type ComponentType } from 'react';

const RELOAD_FLAG = 'fittrack-chunk-reloaded';

/**
 * `lazy()` with recovery for failed chunk loads.
 *
 * Every page in this app is code-split, so each route pulls a separate hashed JS file at
 * navigation time. Those filenames change on every deploy. A browser holding a cached (or
 * CDN-edge-stale) index.html therefore asks for chunk names the server no longer has, the
 * import rejects, and — because Suspense only handles promises, not errors — the failure
 * propagates to the root and React unmounts the whole app: black screen, nothing clickable,
 * or a spinner that never resolves.
 *
 * Fetching the page again is enough to fix it (the fresh index.html points at chunks that
 * exist), so on the first such failure we reload once. A sessionStorage flag makes sure a
 * genuinely broken build can't put the tab into a reload loop — the second failure is
 * rethrown for the ErrorBoundary to render.
 */
/**
 * Warm the other routes' chunks once the app is idle.
 *
 * Code-splitting keeps the first paint cheap, but it moves the download cost to the moment the
 * user taps a tab — which is what makes navigation feel sluggish on a phone. Fetching the
 * remaining pages during idle time means the chunk is already cached when they do.
 */
export function prefetchWhenIdle(factories: Array<() => Promise<unknown>>) {
  if (typeof window === 'undefined') return;

  const run = () => {
    for (const load of factories) {
      // Failures here are irrelevant — the real navigation will surface and handle them.
      load().catch(() => {});
    }
  };

  const ric = (window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  }).requestIdleCallback;

  if (typeof ric === 'function') ric(run, { timeout: 4000 });
  else window.setTimeout(run, 2000);
}

export function lazyWithRetry<T extends ComponentType<unknown>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(RELOAD_FLAG);
      return mod;
    } catch (err) {
      let alreadyReloaded = false;
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === '1';
      } catch {
        // Private mode / blocked storage — treat as "already reloaded" so we never loop.
        alreadyReloaded = true;
      }

      if (!alreadyReloaded) {
        try {
          sessionStorage.setItem(RELOAD_FLAG, '1');
        } catch {
          // ignore
        }
        window.location.reload();
        // Keep the promise unsettled; the reload replaces this page anyway.
        return new Promise<{ default: T }>(() => {});
      }

      throw err;
    }
  });
}
