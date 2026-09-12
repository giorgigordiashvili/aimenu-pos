import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Order } from "@/api/orders";
import Button from "@/components/Button";
import Sheet from "@/components/Sheet";
import { useT } from "@/i18n";
import { money } from "@/lib/money";
import { colors, radius, spacing, typography } from "@/theme/tokens";

interface Props {
  visible: boolean;
  order: Order | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (itemIds: string[]) => void;
}

/** Tick the lines that go on a separate bill. */
export default function SplitItemsSheet({
  visible,
  order,
  loading,
  error,
  onClose,
  onConfirm,
}: Props) {
  const t = useT();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (visible) setSelected(new Set());
  }, [visible]);
  const live = (order?.items ?? []).filter((i) => i.status !== "cancelled");
  const canSplit = selected.size > 0 && selected.size < live.length;

  return (
    <Sheet
      visible={visible}
      title={t.cash.split}
      subtitle={t.cash.splitHint}
      onClose={onClose}
      footer={
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title={t.cash.splitAction.replace("{n}", String(selected.size))}
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canSplit || loading}
            loading={loading}
            onPress={() => onConfirm([...selected])}
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
      {live.map((item) => {
        const on = selected.has(item.id);
        return (
          <Pressable
            key={item.id}
            onPress={() =>
              setSelected((prev) => {
                const next = new Set(prev);
                if (next.has(item.id)) next.delete(item.id);
                else next.add(item.id);
                return next;
              })
            }
            style={[styles.row, on && styles.rowActive]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
          >
            <Ionicons
              name={on ? "checkbox" : "square-outline"}
              size={26}
              color={on ? colors.primary : colors.slate400}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {item.quantity ?? 1}× {item.item_name}
              </Text>
              {item.modifiers?.length ? (
                <Text style={styles.sub}>
                  {item.modifiers.map((m) => m.modifier_name).join(", ")}
                </Text>
              ) : null}
            </View>
            <Text style={styles.price}>
              {money(item.net_price ?? item.total_price)}
            </Text>
          </Pressable>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  name: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  sub: { fontSize: typography.sizes.sm, color: colors.muted, marginTop: 2 },
  price: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  error: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
});
