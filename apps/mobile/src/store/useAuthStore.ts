import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useEntitlementStore } from './useEntitlementStore';

interface AuthState {
  session: Session | null;
  hydrated: boolean;
  init: () => void;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

let initialized = false;

export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  hydrated: false,

  init: () => {
    if (initialized) return;
    initialized = true;

    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, hydrated: true });
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, hydrated: true });
    });
  },

  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    // When email confirmation is required, signUp succeeds with a user but no session yet.
    const needsEmailConfirmation = !error && !!data.user && !data.session;
    return { error: error?.message ?? null, needsEmailConfirmation };
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  },

  signOut: async () => {
    // Every scheduled notification is about the account being signed out of — its streak, its
    // week. Left in place, the next person on this phone would get the previous one's recap on the
    // lock screen. Clearing all of them is exactly right here (sign-in re-arms whatever the device
    // has turned on, with the new account's data). Account deletion signs out too, so it's covered.
    if (Platform.OS !== 'web') await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    await supabase.auth.signOut();
    await useEntitlementStore.getState().logOut();
  },
}));
