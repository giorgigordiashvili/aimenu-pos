import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import Button from "@/components/Button";
import ReasonPicker, {
  EMPTY_REASON,
  type ReasonValue,
} from "@/components/ReasonPicker";
import Sheet from "@/components/Sheet";
import { useT } from "@/i18n";
import { fixed, money, num } from "@/lib/money";
import { colors, radius, spacing, typography } from "@/theme/tokens";

export interface DiscountInput {
  mode: "percent" | "fixed";
  value: string;
  reason_id: string | null;
  reason_text: string;
}

interface Props {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** Amount the discount applies to (order net before order discounts, or the line total). */
  base: number;
  manager: boolean;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (input: DiscountInput) => void;
}

const PERCENT_CHIPS = [5, 10, 15, 20, 25, 50];
const FIXED_CHIPS = [1, 2, 5, 10, 20];

export default function DiscountSheet({
  visible,
  title,
  subtitle,
  base,
  manager,
  loading,
  error,
  onClose,
  onConfirm,
}: Props) {
  const t = useT();
  const [mode, setMode] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("10");
  const [reason, setReason] = useState<ReasonValue>(EMPTY_REASON);

  const amount = useMemo(() => {
    const v = num(value);
    if (v <= 0) return 0;
    const raw =
      mode === "percent" ? (base * Math.min(v, 100)) / 100 : Math.min(v, base);
    return Math.round(raw * 100) / 100;
  }, [mode, value, base]);
  const ready = amount > 0 && !!(reason.reason_id || reason.reason_text.trim());

  return (
    <Sheet
      visible={visible}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title={`${t.cash.discount} −${money(amount)}`}
            variant="primary"
            size="lg"
            fullWidth
            disabled={!ready || loading}
            loading={loading}
            onPress={() =>
              onConfirm({
                mode,
                value: fixed(num(value)),
                reason_id: reason.reason_id,
                reason_text: reason.reason_id ? "" : reason.reason_text.trim(),
              })
            }
          />
          <Button
            title={t.cash.cancel}
            variant="outline"
            size="lg"
            fullWidth
            onPress={onClose}
          />
        </>
      }
    >
      <View style={styles.modes}>
        {(["percent", "fixed"] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => {
              setMode(m);
              setValue(m === "percent" ? "10" : "5");
            }}
            style={[styles.mode, mode === m && styles.modeActive]}
          >
            <Text
              style={[styles.modeText, mode === m && styles.modeTextActive]}
            >
              {m === "percent" ? t.cash.percent : t.cash.fixed}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.chips}>
        {(mode === "percent" ? PERCENT_CHIPS : FIXED_CHIPS).map((c) => (
          <Pressable
            key={c}
            onPress={() => setValue(String(c))}
            style={[styles.chip, num(value) === c && styles.chipActive]}
          >
            <Text
              style={[
                styles.chipText,
                num(value) === c && styles.chipTextActive,
              ]}
            >
              {mode === "percent" ? `${c}%` : `${c} ₾`}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={value}
        onChangeText={setValue}
        keyboardType="decimal-pad"
        style={styles.input}
        accessibilityLabel={t.cash.amount}
      />
      <View style={styles.preview}>
        <Text style={styles.previewLabel}>{t.cash.preview}</Text>
        <Text style={styles.previewValue}>
          {money(Math.max(base - amount, 0))}
        </Text>
      </View>
      <ReasonPicker
        kind="discount"
        value={reason}
        onChange={setReason}
        manager={manager}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  modes: { flexDirection: "row", gap: spacing.sm },
  mode: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  modeActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  modeText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  modeTextActive: { color: colors.primary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: 44,
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  chipText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  chipTextActive: { color: colors.primary },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
    textAlign: "center",
  },
  preview: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.slate50,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  previewLabel: { fontSize: typography.sizes.sm, color: colors.muted },
  previewValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  error: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
});
