import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Button from '@/components/Button';
import { useAuth } from '@/context/AuthContext';
import { useLocale, useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const t = useT();
  const { locale, setLocale } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)/reservations');
    } catch (err) {
      setError(
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          t.login.invalidCredentials
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps='handled'
        >
          <View style={styles.card}>
            <View style={styles.brand}>
              <View style={styles.brandBadge}>
                <Text style={styles.brandBadgeText}>Z</Text>
              </View>
            </View>

            <Text style={styles.heading}>{t.login.title}</Text>
            <Text style={styles.sub}>{t.login.subtitle}</Text>

            <View style={styles.field}>
              <Text style={styles.label}>{t.login.email}</Text>
              <TextInput
                style={styles.input}
                autoCapitalize='none'
                autoCorrect={false}
                keyboardType='email-address'
                textContentType='username'
                value={email}
                onChangeText={setEmail}
                placeholder='you@restaurant.ge'
                placeholderTextColor={colors.slate400}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t.login.password}</Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                textContentType='password'
                value={password}
                onChangeText={setPassword}
                placeholder='••••••••'
                placeholderTextColor={colors.slate400}
                onSubmitEditing={handleSubmit}
                returnKeyType='go'
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button
              title={loading ? t.login.signingIn : t.login.signIn}
              onPress={handleSubmit}
              loading={loading}
              disabled={!canSubmit}
              size='lg'
              fullWidth
            />

            <Text
              style={styles.localeSwitch}
              onPress={() => setLocale(locale === 'ka' ? 'en' : 'ka')}
            >
              {locale === 'ka' ? 'English' : 'ქართული'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    gap: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 40,
    elevation: 6,
  },
  brand: { alignItems: 'center', marginBottom: spacing.sm },
  brandBadge: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBadgeText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: typography.weights.bold,
  },
  localeSwitch: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    marginTop: spacing.sm,
  },
  heading: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  sub: {
    fontSize: typography.sizes.md,
    color: colors.muted,
    marginBottom: spacing.md,
  },
  field: { gap: spacing.xs },
  label: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.sizes.md,
    color: colors.foreground,
    backgroundColor: colors.white,
  },
  error: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
});
