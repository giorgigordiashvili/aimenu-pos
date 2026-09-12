import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import Button from "@/components/Button";
import Sheet from "@/components/Sheet";
import { useT } from "@/i18n";
import { colors, radius, spacing, typography } from "@/theme/tokens";

interface Props {
  visible: boolean;
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (code: string) => void;
}

/** Type a promo code for the open order (the backend validates channel, dates, limits). */
export default function PromoCodeSheet({
  visible,
  subtitle,
  loading,
  error,
  onClose,
  onConfirm,
}: Props) {
  const t = useT();
  const [code, setCode] = useState("");
  return (
    <Sheet
      visible={visible}
      title={t.cash.promoCode}
      subtitle={subtitle}
      onClose={onClose}
    >
      <View style={styles.body}>
        <TextInput
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          placeholder={t.cash.enterCode}
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.input}
          testID="promo-code-input"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          title={t.cash.applyCode}
          fullWidth
          loading={loading}
          disabled={!code.trim()}
          onPress={() => onConfirm(code.trim())}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: typography.sizes.lg,
    letterSpacing: 2,
    color: colors.foreground,
    backgroundColor: colors.surface,
  },
  error: { color: colors.danger, fontSize: 13 },
});
