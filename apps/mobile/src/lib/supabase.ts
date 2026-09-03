import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// expo-secure-store has no real implementation on web (there's no OS keychain to back it), so
// the auth session there falls back to AsyncStorage instead — same tradeoff Expo's own docs
// make for web builds. Native platforms keep the real, encrypted SecureStore.
//
// expo-secure-store caps individual values at 2048 bytes, which is enough for a Supabase
// auth session (short-lived access token + refresh token), so no chunking is needed here.
const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const authStorage = Platform.OS === 'web' ? AsyncStorage : SecureStoreAdapter;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set — auth and cloud sync ' +
      'will fail until apps/mobile/.env is filled in (see .env.example).'
  );
}

// The anon key is safe to ship in the client — it identifies the project, not a user; every
// table it can touch is locked down by RLS policies keyed on auth.uid().
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
