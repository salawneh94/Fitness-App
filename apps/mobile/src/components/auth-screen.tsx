import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@fittrack/shared';
import { useAuthStore } from '@/store/useAuthStore';
import TextField from './ui/text-field';
import PressableScale from '@/components/ui/pressable-scale';

type Mode = 'signIn' | 'signUp';

export default function AuthScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const canSubmit = email.trim().length > 3 && password.length >= 6 && !loading;

  async function submit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === 'signIn') {
        const { error } = await signIn(email.trim(), password);
        if (error) setError(error);
      } else {
        const { error, needsEmailConfirmation } = await signUp(email.trim(), password);
        if (error) setError(error);
        else if (needsEmailConfirmation) setConfirmationSent(true);
      }
    } finally {
      setLoading(false);
    }
  }

  if (confirmationSent) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center px-6" style={{ backgroundColor: colors.background }}>
        <Text className="text-2xl font-bold text-center mb-3" style={{ color: colors.textPrimary }}>
          Check your email
        </Text>
        <Text className="text-sm text-center mb-8" style={{ color: colors.textSecondary }}>
          We sent a confirmation link to {email.trim()}. Tap it, then come back and sign in.
        </Text>
        <PressableScale
          onPress={() => {
            setConfirmationSent(false);
            setMode('signIn');
            setPassword('');
          }}
          className="px-5 py-2.5 rounded-full"
          style={{ backgroundColor: colors.brandPrimaryDark }}
        >
          <Text className="text-white text-sm font-semibold">Back to sign in</Text>
        </PressableScale>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView className="flex-1 px-6" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          <Text className="text-2xl font-bold mb-1" style={{ color: colors.textPrimary }}>
            {mode === 'signIn' ? 'Welcome back' : 'Create your account'}
          </Text>
          <Text className="text-sm mb-8" style={{ color: colors.textSecondary }}>
            {mode === 'signIn'
              ? 'Sign in to sync your data across devices.'
              : 'Your data follows you across devices once you sign up.'}
          </Text>

          <View className="gap-3 mb-2">
            <TextField
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />
            <TextField
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            />
          </View>

          {mode === 'signUp' && (
            <Text className="text-xs mb-4" style={{ color: colors.textMuted }}>
              At least 6 characters.
            </Text>
          )}

          {error && (
            <Text className="text-sm mb-4" style={{ color: colors.statusCritical }}>
              {error}
            </Text>
          )}

          <PressableScale hapticStyle="success"
            onPress={submit}
            disabled={!canSubmit}
            className="items-center py-3.5 rounded-full mt-2"
            style={{ backgroundColor: colors.brandPrimaryDark, opacity: canSubmit ? 1 : 0.4 }}
          >
            <Text className="text-white text-sm font-semibold">
              {loading ? 'Please wait…' : mode === 'signIn' ? 'Sign In' : 'Sign Up'}
            </Text>
          </PressableScale>

          <PressableScale
            onPress={() => {
              setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'));
              setError(null);
            }}
            className="items-center py-4"
          >
            <Text className="text-sm" style={{ color: colors.textMuted }}>
              {mode === 'signIn' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={{ color: colors.brandPrimary, fontWeight: '600' }}>
                {mode === 'signIn' ? 'Sign up' : 'Sign in'}
              </Text>
            </Text>
          </PressableScale>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
