import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  confirmLoyaltyCode,
  validateLoyaltyCode,
  type LoyaltyValidateResponse,
} from '@/api/loyalty';
import Button from '@/components/Button';
import { useT } from '@/i18n';
import { colors, radius, shadows, spacing, typography } from '@/theme/tokens';

type BackendErrorCode =
  | 'not_found'
  | 'expired'
  | 'already_handled'
  | 'insufficient'
  | 'generic';

function normaliseError(err: unknown): BackendErrorCode {
  const code = (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data
    ?.error?.code;
  const known: BackendErrorCode[] = ['not_found', 'expired', 'already_handled', 'insufficient'];
  if (code && known.includes(code as BackendErrorCode)) return code as BackendErrorCode;
  return 'generic';
}

export default function LoyaltyRedeemScreen() {
  const router = useRouter();
  const t = useT();
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [validated, setValidated] = useState<LoyaltyValidateResponse | null>(null);
  const [errorCode, setErrorCode] = useState<BackendErrorCode | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const validate = useMutation({
    mutationFn: (c: string) => validateLoyaltyCode(c.trim()),
    onSuccess: (data: any) => {
      const payload: LoyaltyValidateResponse =
        (data && typeof data === 'object' && 'data' in data ? (data as any).data : data);
      setValidated(payload);
      setErrorCode(null);
    },
    onError: err => {
      setValidated(null);
      setErrorCode(normaliseError(err));
    },
  });

  const confirm = useMutation({
    mutationFn: (c: string) => confirmLoyaltyCode(c.trim()),
    onSuccess: () => {
      setSuccessMessage(t.loyalty.confirmed);
      setValidated(null);
      setCode('');
      qc.invalidateQueries();
      setTimeout(() => router.back(), 1200);
    },
    onError: err => setErrorCode(normaliseError(err)),
  });

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <Text style={styles.title}>{t.loyalty.title}</Text>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name='close' size={20} color={colors.slate700} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps='handled'>
          <View style={styles.card}>
            <Text style={styles.label}>{t.loyalty.codeHint}</Text>
            <TextInput
              style={styles.input}
              autoCapitalize='none'
              autoCorrect={false}
              value={code}
              onChangeText={txt => {
                setCode(txt);
                if (validated) setValidated(null);
                if (errorCode) setErrorCode(null);
                if (successMessage) setSuccessMessage(null);
              }}
              placeholder='ABcd1234...'
              placeholderTextColor={colors.slate400}
              multiline
              numberOfLines={2}
            />
            <Button
              title={t.loyalty.validate}
              variant='primary'
              size='lg'
              fullWidth
              disabled={!code.trim() || validate.isPending}
              loading={validate.isPending}
              onPress={() => validate.mutate(code)}
            />
          </View>

          {errorCode ? (
            <View style={styles.errorBox}>
              <Ionicons name='alert-circle-outline' size={18} color={colors.danger} />
              <Text style={styles.errorText}>
                {t.loyalty.errors[errorCode]}
              </Text>
            </View>
          ) : null}

          {successMessage ? (
            <View style={styles.successBox}>
              <Ionicons name='checkmark-circle' size={20} color={colors.successDark} />
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          ) : null}

          {validated ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t.loyalty.validated}</Text>
              <Row label={t.loyalty.customer} value={validated.customer_name} />
              <Row label={t.loyalty.program} value={validated.program?.name ?? '—'} />
              <Row
                label={t.loyalty.reward}
                value={`${validated.program.reward_quantity}× ${validated.program.reward_item_detail?.name ?? ''}`}
              />
              <Row
                label={t.loyalty.expiresAt}
                value={new Date(validated.expires_at).toLocaleString()}
              />
              <View style={{ height: spacing.md }} />
              <Button
                title={t.loyalty.confirm}
                variant='success'
                size='lg'
                fullWidth
                loading={confirm.isPending}
                onPress={() => confirm.mutate(validated.code)}
              />
            </View>
          ) : null}

          {validate.isPending ? (
            <ActivityIndicator size='large' color={colors.primary} />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.md,
    ...shadows.sm,
  },
  label: {
    fontSize: typography.sizes.sm,
    color: colors.muted,
    fontWeight: typography.weights.medium,
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
    minHeight: 64,
    textAlignVertical: 'top',
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.successDark,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  rowLabel: { fontSize: typography.sizes.sm, color: colors.muted },
  rowValue: {
    fontSize: typography.sizes.md,
    color: colors.foreground,
    fontWeight: typography.weights.semibold,
    flexShrink: 1,
    textAlign: 'right',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerTint,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: typography.sizes.sm, flex: 1 },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successTint,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  successText: { color: colors.successDark, fontSize: typography.sizes.md, fontWeight: typography.weights.semibold },
});
