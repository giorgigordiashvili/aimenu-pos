import { useRouter } from 'expo-router';
import { Alert, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import Button from '@/components/Button';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const router = useRouter();
  const { t, locale, setLocale } = useLocale();

  function handleSignOut() {
    const run = async () => {
      await signOut();
      router.replace('/login');
    };
    if (Platform.OS === 'web') {
      if (typeof globalThis.confirm === 'function' && !globalThis.confirm(t.settings.signOutConfirm)) {
        return;
      }
      run();
      return;
    }
    Alert.alert(t.settings.signOutConfirm, t.settings.signOutConfirmBody, [
      { text: t.settings.cancel, style: 'cancel' },
      { text: t.settings.signOut, style: 'destructive', onPress: run },
    ]);
  }

  return (
    <SafeAreaView style={styles.root}>
      <TopBar title={t.settings.title} />
      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.settings.account}</Text>
          <Text style={styles.cardBody}>{t.settings.accountBody}</Text>
          <Button title={t.settings.signOut} variant='danger' fullWidth onPress={handleSignOut} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.settings.language}</Text>
          <View style={styles.localeRow}>
            <LocaleButton
              active={locale === 'ka'}
              label='ქართული'
              onPress={() => setLocale('ka')}
            />
            <LocaleButton
              active={locale === 'en'}
              label='English'
              onPress={() => setLocale('en')}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.settings.about}</Text>
          <Text style={styles.cardBody}>AiMenu POS · v0.1.0</Text>
          <Text style={styles.cardBody}>
            {process.env.EXPO_PUBLIC_API_URL ?? 'https://admin.aimenu.ge'}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function LocaleButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.localeBtn, active && styles.localeBtnActive]}
    >
      <Text style={[styles.localeBtnText, active && styles.localeBtnTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: {
    padding: spacing.xl,
    gap: spacing.lg,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    gap: spacing.md,
  },
  cardTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  cardBody: { fontSize: typography.sizes.md, color: colors.muted, lineHeight: 22 },
  localeRow: { flexDirection: 'row', gap: spacing.sm },
  localeBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  localeBtnActive: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
  },
  localeBtnText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.foreground,
  },
  localeBtnTextActive: {
    color: colors.white,
  },
});
