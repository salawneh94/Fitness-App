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
  /** Email a one-time code for resetting the password. Succeeds whether or not the address has an
   * account — saying which would tell anyone who asks who is registered. */
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  /** Check the emailed code and set the new password. Signs the user in on success. */
  resetPassword: (email: string, code: string, newPassword: string) => Promise<{ error: string | null }>;
}

let initialized = false;
/**
 * True while a password reset is between "code accepted" and "new password saved". Accepting the
 * code is what signs the user in, so without this the app would open on the old password the
 * moment the code checked out — before the new one was set, and with nowhere left to report it
 * if setting it failed.
 */
let resettingPassword = false;

type SignOutHook = () => void | Promise<void>;
const signOutHooks: { before: SignOutHook[]; after: SignOutHook[] } = { before: [], after: [] };

/**
 * Run something as part of every sign-out: `before` while the session is still valid (a last
 * chance to send queued writes), `after` once it is gone (clearing what belonged to that account).
 * Registered by the modules that own the state, so this store doesn't have to import them — they
 * already import it.
 */
export function onSignOut(when: 'before' | 'after', hook: SignOutHook) {
  signOutHooks[when].push(hook);
}

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
      if (resettingPassword) return;
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

  sendPasswordReset: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error?.message ?? null };
  },

  resetPassword: async (email, code, newPassword) => {
    resettingPassword = true;
    try {
      const { error: codeError } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
      if (codeError) {
        // The server's wording ("Token has expired or is invalid") is accurate but reads like a fault.
        const wrongCode = codeError.status === 403 || /expired|invalid/i.test(codeError.message);
        return { error: wrongCode ? 'That code is wrong or has expired. Check it, or send a new one.' : codeError.message };
      }
      const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
      if (passwordError) {
        // The code is spent but the password is unchanged. Staying signed in on the strength of an
        // emailed code alone isn't what was asked for, so back out and say what to do next.
        await supabase.auth.signOut({ scope: 'local' });
        return { error: `${passwordError.message} Send a new code to try again.` };
      }
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Something went wrong. Please try again.' };
    } finally {
      resettingPassword = false;
      const { data } = await supabase.auth.getSession();
      set({ session: data.session, hydrated: true });
    }
  },

  signOut: async () => {
    // Every scheduled notification is about the account being signed out of — its streak, its
    // week. Left in place, the next person on this phone would get the previous one's recap on the
    // lock screen. Clearing all of them is exactly right here (sign-in re-arms whatever the device
    // has turned on, with the new account's data). Account deletion signs out too, so it's covered.
    if (Platform.OS !== 'web') await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    for (const hook of signOutHooks.before) await Promise.resolve(hook()).catch(() => {});
    await supabase.auth.signOut();
    await useEntitlementStore.getState().logOut();
    for (const hook of signOutHooks.after) await Promise.resolve(hook()).catch(() => {});
  },
}));
