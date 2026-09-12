import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radius, spacing, typography } from "@/theme/tokens";

interface Props {
  message: string | null;
  tone?: "danger" | "success";
  autoHideMs?: number;
  onHide: () => void;
}

/** Small auto-hiding notice rendered in the flow (never over buttons). */
export default function InlineBanner({
  message,
  tone = "danger",
  autoHideMs = 4000,
  onHide,
}: Props) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onHide, autoHideMs);
    return () => clearTimeout(id);
  }, [message, autoHideMs, onHide]);

  if (!message) return null;
  return (
    <Pressable
      onPress={onHide}
      style={[styles.root, tone === "danger" ? styles.danger : styles.success]}
      accessibilityRole="alert"
    >
      <Ionicons
        name={tone === "danger" ? "alert-circle" : "checkmark-circle"}
        size={20}
        color={colors.white}
      />
      <Text style={styles.text}>{message}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  danger: { backgroundColor: colors.danger },
  success: { backgroundColor: colors.successDark },
  text: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    flex: 1,
  },
});
