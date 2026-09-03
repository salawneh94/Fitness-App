import { useEffect, useState } from 'react';
import { useAppStore } from './useAppStore';

/**
 * AsyncStorage-backed persist rehydrates asynchronously (unlike localStorage on
 * web), so `profile` briefly reads null even for a returning user. Screens that
 * branch on profile presence (routing, onboarding gate) must wait for this
 * before deciding what to show, or a returning user flashes onboarding first.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useAppStore.persist.hasHydrated());

  useEffect(() => {
    if (hydrated) return;
    const unsub = useAppStore.persist.onFinishHydration(() => setHydrated(true));
    // In case hydration finished between the initial state read and this effect running.
    if (useAppStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, [hydrated]);

  return hydrated;
}
