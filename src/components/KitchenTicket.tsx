import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import type { KitchenOrderRow, OrderItem } from "@/api/orders";
import Button from "@/components/Button";
import type { Dict } from "@/i18n";
import { colors, radius, shadows, spacing, typography } from "@/theme/tokens";

export type KitchenLane = "confirmed" | "preparing" | "ready";

// Sizes tuned for a tablet on the pass, read from a step away.
const SIZE = {
  orderNo: 24,
  item: 20,
  qty: 20,
  meta: 16,
  elapsed: 18,
  button: 20,
};

interface Props {
  row: KitchenOrderRow;
  lane: KitchenLane;
  now: number;
  busy: boolean;
  /** True for a moment after the ticket first appears: pulses the card. */
  flash: boolean;
  labels: Dict["kitchen"];
  onAdvance: () => void;
  onCancel?: () => void;
}

export function startedAt(row: KitchenOrderRow): number {
  return new Date(row.confirmed_at ?? row.created_at).getTime();
}

export function elapsedTone(minutes: number): "normal" | "warning" | "danger" {
  return minutes > 25 ? "danger" : minutes >= 15 ? "warning" : "normal";
}

function formatClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const ELAPSED_STYLE = {
  normal: { bg: colors.slate100, fg: colors.slate700 },
  warning: { bg: colors.warningTint, fg: colors.warningDark },
  danger: { bg: colors.dangerTint, fg: colors.danger },
} as const;

const ACTION: Record<
  KitchenLane,
  {
    variant: "primary" | "success" | "secondary";
    key: "accept" | "ready" | "pickedUp";
  }
> = {
  confirmed: { variant: "primary", key: "accept" },
  preparing: { variant: "success", key: "ready" },
  ready: { variant: "secondary", key: "pickedUp" },
};

function TicketItem({
  item,
  labels,
}: {
  item: OrderItem;
  labels: Dict["kitchen"];
}) {
  const isBar = item.preparation_station === "bar";
  return (
    <View style={styles.item}>
      <View style={styles.itemRow}>
        <Text style={styles.qty}>{item.quantity ?? 1} ×</Text>
        <Text style={styles.itemName}>{item.item_name}</Text>
        {isBar ? (
          <View style={styles.stationTag}>
            <Text style={styles.stationText}>
              {labels.stationBar.toUpperCase()}
            </Text>
          </View>
        ) : null}
      </View>
      {item.modifiers?.length ? (
        <Text style={styles.modifiers}>
          {item.modifiers.map((m) => m.modifier_name).join(" · ")}
        </Text>
      ) : null}
      {item.special_instructions ? (
        <View style={styles.instructions}>
          <Text style={styles.instructionsText}>
            ⚠ {item.special_instructions}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function KitchenTicketInner({
  row,
  lane,
  now,
  busy,
  flash,
  labels,
  onAdvance,
  onCancel,
}: Props) {
  const minutes = Math.max(Math.floor((now - startedAt(row)) / 60_000), 0);
  const tone = elapsedTone(minutes);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!flash) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: false,
        }),
      ]),
      { iterations: 4 },
    );
    pulse.start(() => opacity.setValue(1));
    return () => pulse.stop();
  }, [flash, opacity]);

  const action = ACTION[lane];
  const where = row.table_number
    ? `${labels.table} ${row.table_number}`
    : (labels.orderTypes[
        row.order_type as keyof Dict["kitchen"]["orderTypes"]
      ] ??
      row.order_type ??
      "");

  return (
    <Animated.View
      style={[
        styles.card,
        tone === "danger" && styles.cardDanger,
        flash && styles.cardFlash,
        { opacity },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.orderNo}>{row.order_number}</Text>
        <View
          style={[styles.elapsed, { backgroundColor: ELAPSED_STYLE[tone].bg }]}
        >
          <Text style={[styles.elapsedText, { color: ELAPSED_STYLE[tone].fg }]}>
            ⏱ {labels.elapsed.replace("{min}", String(minutes))}
          </Text>
        </View>
      </View>
      <Text style={styles.meta}>
        {where}
        {row.customer_name ? ` · ${row.customer_name}` : ""}
        {` · ${formatClock(row.confirmed_at ?? row.created_at)}`}
      </Text>

      <View style={styles.items}>
        {row.items.map((item) => (
          <TicketItem key={item.id} item={item} labels={labels} />
        ))}
      </View>

      {row.customer_notes ? (
        <View style={styles.notes}>
          <Text style={styles.notesLabel}>
            {labels.customerNotes.toUpperCase()}
          </Text>
          <Text style={styles.notesText}>{row.customer_notes}</Text>
        </View>
      ) : null}

      <Button
        title={labels[action.key]}
        variant={action.variant}
        size="lg"
        fullWidth
        loading={busy}
        onPress={onAdvance}
        style={styles.action}
        textStyle={styles.actionText}
        accessibilityLabel={`${labels[action.key]} ${row.order_number}`}
      />
      {onCancel ? (
        <Pressable
          onPress={onCancel}
          disabled={busy}
          style={styles.cancel}
          hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
          accessibilityRole="button"
        >
          <Text style={styles.cancelText}>{labels.cantMake}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const KitchenTicket = React.memo(KitchenTicketInner);
export default KitchenTicket;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.sm,
  },
  cardDanger: {
    borderColor: colors.danger,
  },
  cardFlash: {
    backgroundColor: colors.highlightSoft,
    borderColor: colors.highlight,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  orderNo: {
    fontSize: SIZE.orderNo,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  elapsed: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  elapsedText: {
    fontSize: SIZE.elapsed,
    fontWeight: typography.weights.bold,
  },
  meta: {
    fontSize: SIZE.meta,
    color: colors.muted,
    marginTop: -spacing.xs,
  },
  items: {
    gap: spacing.sm,
  },
  item: {
    gap: spacing.xxs,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  qty: {
    width: 48,
    fontSize: SIZE.qty,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  itemName: {
    flex: 1,
    fontSize: SIZE.item,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  stationTag: {
    backgroundColor: colors.accentTint,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  stationText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
  modifiers: {
    fontSize: SIZE.meta,
    color: colors.mutedStrong,
    paddingLeft: 48 + spacing.sm,
  },
  instructions: {
    marginLeft: 48 + spacing.sm,
    backgroundColor: colors.highlightSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  instructionsText: {
    fontSize: SIZE.meta,
    fontWeight: typography.weights.semibold,
    color: colors.warningDark,
  },
  notes: {
    backgroundColor: colors.infoTint,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 2,
  },
  notesLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.info,
  },
  notesText: {
    fontSize: SIZE.meta,
    color: colors.foreground,
  },
  action: {
    minHeight: 64,
  },
  actionText: {
    fontSize: SIZE.button,
    fontWeight: typography.weights.bold,
  },
  cancel: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: SIZE.meta,
    fontWeight: typography.weights.semibold,
    color: colors.danger,
  },
});
