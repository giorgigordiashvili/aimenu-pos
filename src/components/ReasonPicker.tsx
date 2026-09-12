import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { listReasons, type ReasonOption } from "@/api/payments";
import { useT } from "@/i18n";
import { colors, radius, spacing, typography } from "@/theme/tokens";

export interface ReasonValue {
  reason_id: string | null;
  reason_text: string;
  /** For display: the chip label or the typed text. */
  label: string;
}

export const EMPTY_REASON: ReasonValue = {
  reason_id: null,
  reason_text: "",
  label: "",
};

interface Props {
  kind: ReasonOption["kind"];
  value: ReasonValue;
  onChange: (v: ReasonValue) => void;
  /** Whether manager-only reasons are selectable for this user. */
  manager: boolean;
}

/**
 * Server-defined reasons as big chips plus a free-text line. A stored
 * reason sends its id; a built-in default or typed text sends the text.
 */
export default function ReasonPicker({
  kind,
  value,
  onChange,
  manager,
}: Props) {
  const t = useT();
  const reasons = useQuery({
    queryKey: ["reasons", kind],
    queryFn: () => listReasons(kind),
    staleTime: 60_000,
  });
  const selectedLabel = value.reason_id ?? value.label;

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{t.cash.reason}</Text>
      <View style={styles.chips}>
        {(reasons.data ?? []).map((r) => {
          const locked = r.requires_manager && !manager;
          const active = r.id
            ? value.reason_id === r.id
            : value.label === r.label && !value.reason_id;
          return (
            <Pressable
              key={r.id ?? r.label}
              disabled={locked}
              onPress={() =>
                onChange({
                  reason_id: r.id,
                  reason_text: r.id ? "" : r.label,
                  label: r.label,
                })
              }
              style={[
                styles.chip,
                active && styles.chipActive,
                locked && styles.chipLocked,
              ]}
              accessibilityRole="button"
            >
              {locked ? (
                <Ionicons
                  name="lock-closed"
                  size={14}
                  color={colors.slate400}
                />
              ) : null}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={value.reason_id ? "" : value.reason_text}
        onChangeText={(text) =>
          onChange({ reason_id: null, reason_text: text, label: text })
        }
        placeholder={t.cash.reasonRequired}
        placeholderTextColor={colors.slate400}
        style={styles.input}
        accessibilityLabel={t.cash.reason}
      />
      {selectedLabel ? null : (
        <Text style={styles.hint}>{t.cash.reasonRequired}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  label: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  chipLocked: { opacity: 0.5 },
  chipText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  chipTextActive: { color: colors.primary },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.foreground,
    backgroundColor: colors.surface,
  },
  hint: { fontSize: typography.sizes.xs, color: colors.muted },
});
