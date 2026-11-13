import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@fittrack/shared';
import { useAuthStore } from '@/store/useAuthStore';
import TextField from './ui/text-field';
import PressableScale from '@/components/ui/pressable-scale';

// 'forgot' asks for the email; 'reset' takes the emailed code and the new password.
type Mode = 'signIn' | 'signUp' | 'forgot' | 'reset';

const TITLES: Record<Mode, { title: string; sub: string }> = {
  signIn: { title: 'Welcome back', sub: 'Sign in to sync your data across devices.' },
  signUp: { title: 'Create your account', sub: 'Your data follows you across devices once you sign up.' },
  forgot: { title: 'Reset your password', sub: 'Enter the email you signed up with and we’ll send you a code.' },
  reset: { title: 'Check your email', sub: '' },
};
const MIN_PASSWORD = 6;

export default function AuthScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const sendPasswordReset = useAuthStore((s) => s.sendPasswordReset);
  const resetPassword = useAuthStore((s) => s.resetPassword);

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const hasEmail = email.trim().length > 3;
  const canSubmit =
    !loading &&
    hasEmail &&
    (mode === 'forgot' || password.length >= MIN_PASSWORD) &&
    // Codes are six digits by default; the project can be configured for up to ten.
    (mode !== 'reset' || /^\d{6,10}$/.test(code.trim()));

  function go(next: Mode) {
    setMode(next);
    setError(null);
    setPassword('');
    setCode('');
  }

  async function submit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === 'signIn') {
        const { error } = await signIn(email.trim(), password);
        if (error) setError(error);
      } else if (mode === 'forgot') {
        const { error } = await sendPasswordReset(email.trim());
        if (error) setError(error);
        else go('reset');
      } else if (mode === 'reset') {
        // Success signs the user in, which replaces this screen — nothing more to do here.
        const { error } = await resetPassword(email.trim(), code.trim(), password);
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
            {TITLES[mode].title}
          </Text>
          <Text className="text-sm mb-8" style={{ color: colors.textSecondary }}>
            {mode === 'reset'
              ? `If there’s an account for ${email.trim()}, we’ve sent it a code. Enter it here with your new password.`
              : TITLES[mode].sub}
          </Text>

          <View className="gap-3 mb-2">
            {mode !== 'reset' && (
              <TextField
                placeholder="Email"
                accessibilityLabel="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
              />
            )}
            {mode === 'reset' && (
              <TextField
                placeholder="Code from the email"
                accessibilityLabel="Code from the email"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={10}
              />
            )}
            {mode !== 'forgot' && (
              <TextField
                placeholder={mode === 'reset' ? 'New password' : 'Password'}
                accessibilityLabel={mode === 'reset' ? 'New password' : 'Password'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              />
            )}
          </View>

          {mode === 'signIn' && (
            <PressableScale accessibilityRole="button" onPress={() => go('forgot')} className="self-end py-1.5">
              <Text className="text-xs font-medium" style={{ color: colors.brandPrimary }}>
                Forgot password?
              </Text>
            </PressableScale>
          )}

          {(mode === 'signUp' || mode === 'reset') && (
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
              {loading
                ? 'Please wait…'
                : mode === 'signIn'
                  ? 'Sign In'
                  : mode === 'signUp'
                    ? 'Sign Up'
                    : mode === 'forgot'
                      ? 'Send reset code'
                      : 'Set new password'}
            </Text>
          </PressableScale>

          {mode === 'reset' && (
            <PressableScale accessibilityRole="button" onPress={() => go('forgot')} className="items-center pt-4">
              <Text className="text-sm" style={{ color: colors.textMuted }}>
                Didn’t get it? <Text style={{ color: colors.brandPrimary, fontWeight: '600' }}>Send a new code</Text>
              </Text>
            </PressableScale>
          )}

          <PressableScale accessibilityRole="button" onPress={() => go(mode === 'signIn' ? 'signUp' : 'signIn')} className="items-center py-4">
            <Text className="text-sm" style={{ color: colors.textMuted }}>
              {mode === 'signIn' ? "Don't have an account? " : mode === 'signUp' ? 'Already have an account? ' : 'Remembered it? '}
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
