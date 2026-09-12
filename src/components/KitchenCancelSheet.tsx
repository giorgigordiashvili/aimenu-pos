import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { KitchenOrderRow } from "@/api/orders";
import Button from "@/components/Button";
import { dictionaries, useT } from "@/i18n";
import { colors, radius, spacing, typography } from "@/theme/tokens";

export type CancelReason = "out_of_ingredients" | "spoiled" | "other";
const REASONS: CancelReason[] = ["out_of_ingredients", "spoiled", "other"];

interface Props {
  order: KitchenOrderRow | null;
  onClose: () => void;
  /** Called with the reason text that goes to the backend. */
  onConfirm: (reason: string) => void;
}

/**
 * "Can't make" flow: pick a reason (big chips), confirm, cancel the order.
 * The reason is sent in English so managers and the admin read one vocabulary.
 */
export default function KitchenCancelSheet({
  order,
  onClose,
  onConfirm,
}: Props) {
  const t = useT();

  function pick(key: CancelReason) {
    if (!order) return;
    const title = t.kitchen.cancelConfirmTitle.replace(
      "{order}",
      order.order_number,
    );
    const body = t.kitchen.cancelReasons[key];
    const run = () =>
      onConfirm(`Kitchen: ${dictionaries.en.kitchen.cancelReasons[key]}`);
    if (Platform.OS === "web") {
      if (
        typeof globalThis.confirm !== "function" ||
        globalThis.confirm(`${title}\n\n${body}`)
      )
        run();
      return;
    }
    Alert.alert(title, body, [
      { text: t.kitchen.back, style: "cancel" },
      { text: t.kitchen.cancelAction, style: "destructive", onPress: run },
    ]);
  }

  return (
    <Modal
      visible={!!order}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{t.kitchen.cantMakeTitle}</Text>
          <Text style={styles.sub}>{order?.order_number}</Text>
          <View style={styles.chips}>
            {REASONS.map((key) => (
              <Pressable
                key={key}
                onPress={() => pick(key)}
                style={({ pressed }) => [
                  styles.chip,
                  pressed && styles.chipPressed,
                ]}
                accessibilityRole="button"
              >
                <Text style={styles.chipText}>
                  {t.kitchen.cancelReasons[key]}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button
            title={t.kitchen.back}
            variant="outline"
            size="lg"
            fullWidth
            onPress={onClose}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(16, 24, 40, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  sheet: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  sub: {
    fontSize: typography.sizes.md,
    color: colors.muted,
    marginTop: -spacing.sm,
  },
  chips: {
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  chip: {
    minHeight: 64,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.danger,
    backgroundColor: colors.dangerTint,
  },
  chipPressed: {
    backgroundColor: colors.danger,
  },
  chipText: {
    fontSize: 20,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
});
