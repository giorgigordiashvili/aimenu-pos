import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import type { Order } from "@/api/orders";
import {
  assignCourier,
  cancelCourier,
  dispatchErrorCode,
  listCouriers,
  requestCourier,
  updateDelivery,
  type CourierProvider,
  type DeliveryStatus,
} from "@/api/ordering";
import { can, moduleOn } from "@/api/restaurants";
import Button from "@/components/Button";
import Sheet from "@/components/Sheet";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/i18n";
import { money } from "@/lib/money";
import { colors, radius, spacing, typography } from "@/theme/tokens";

function hhmm(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const TONE: Record<DeliveryStatus, string> = {
  pending: colors.slate400,
  quoted: colors.info,
  requested: colors.warning,
  accepted: colors.warning,
  assigned: colors.info,
  picked_up: colors.accent,
  delivered: colors.success,
  failed: colors.danger,
  cancelled: colors.danger,
};

interface Props {
  order: Order;
  onChanged: () => void;
}

/**
 * Pickup / delivery block on the order screen: the time the guest chose,
 * the address, and the courier (own rider or Wolt Drive / Glovo hand-off).
 */
export default function DeliveryPanel({ order, onChanged }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const { currentRestaurant } = useAuth();
  const [pickProvider, setPickProvider] = useState(false);
  const [pickCourier, setPickCourier] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const on = moduleOn(currentRestaurant, "online_ordering");
  const canDispatch = can(currentRestaurant, "orders", "update");

  const couriers = useQuery({
    queryKey: ["couriers"],
    queryFn: () => listCouriers(true),
    enabled: on && pickCourier,
  });

  const fail = (err: unknown) => {
    const code = dispatchErrorCode(err);
    const known = code
      ? (t.ordering.errors as Record<string, string>)[code]
      : undefined;
    setError(known ?? t.ordering.errors.generic);
  };
  const done = () => {
    setError(null);
    qc.invalidateQueries({ queryKey: ["deliveries"] });
    onChanged();
  };
  const request = useMutation({
    mutationFn: (provider?: CourierProvider) =>
      requestCourier(order.id, provider),
    onSuccess: done,
    onError: fail,
  });
  const assign = useMutation({
    mutationFn: (courierId: string) => assignCourier(order.id, courierId),
    onSuccess: done,
    onError: fail,
  });
  const move = useMutation({
    mutationFn: (status: "picked_up" | "delivered") =>
      updateDelivery(order.id, status),
    onSuccess: done,
    onError: fail,
  });
  const cancel = useMutation({
    mutationFn: () => cancelCourier(order.id, "Cancelled from POS"),
    onSuccess: done,
    onError: fail,
  });

  if (order.order_type !== "takeaway" && order.order_type !== "delivery")
    return null;
  const when = order.scheduled_for
    ? `${t.ordering.scheduledFor} ${hhmm(order.scheduled_for)}`
    : order.estimated_ready_at
      ? `${t.ordering.asapBy} ${hhmm(order.estimated_ready_at)}`
      : "";
  const d = order.delivery ?? null;
  const open =
    d &&
    ["quoted", "requested", "accepted", "assigned", "picked_up"].includes(
      d.status,
    );
  const address = order.address_json ?? {};
  const details = ["entrance", "floor", "apartment"]
    .filter((k) => address[k])
    .map(
      (k) =>
        `${(t.ordering.address as Record<string, string>)[k]} ${address[k]}`,
    )
    .join(" · ");
  const orderActive = !["completed", "cancelled", "pending_payment"].includes(
    String(order.status),
  );

  return (
    <View style={styles.box} testID="delivery-panel">
      <View style={styles.headRow}>
        <Ionicons
          name={order.order_type === "delivery" ? "bicycle" : "bag-handle"}
          size={18}
          color={colors.foreground}
        />
        <Text style={styles.title}>
          {order.order_type === "delivery"
            ? t.ordering.delivery
            : t.ordering.pickup}
        </Text>
        {when ? <Text style={styles.when}>{when}</Text> : null}
      </View>
      {order.order_type === "delivery" ? (
        <>
          <Text style={styles.addr}>{order.delivery_address}</Text>
          {details ? <Text style={styles.muted}>{details}</Text> : null}
          {order.delivery_instructions ? (
            <Text style={styles.muted}>“{order.delivery_instructions}”</Text>
          ) : null}
          <View style={styles.feeRow}>
            <Text style={styles.muted}>
              {t.ordering.deliveryFee} {money(order.delivery_fee)}
            </Text>
            {d?.cost && Number(d.cost) > 0 ? (
              <Text style={styles.muted}>
                {t.ordering.courierCost} {money(d.cost)}
              </Text>
            ) : null}
          </View>
          {d ? (
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: TONE[d.status] }]} />
              <Text style={styles.statusText}>
                {(t.ordering.status as Record<string, string>)[d.status] ??
                  d.status}
                {" · "}
                {(t.ordering.providers as Record<string, string>)[d.provider] ??
                  d.provider}
                {d.courier_name ? ` · ${d.courier_name}` : ""}
                {d.dropoff_eta ? ` · ETA ${hhmm(d.dropoff_eta)}` : ""}
              </Text>
            </View>
          ) : null}
          {d?.error ? <Text style={styles.error}>{d.error}</Text> : null}
          {d?.tracking_url ? (
            <Pressable
              onPress={() => Linking.openURL(d.tracking_url)}
              style={styles.link}
            >
              <Ionicons name="navigate" size={14} color={colors.info} />
              <Text style={styles.linkText}>{t.ordering.track}</Text>
            </Pressable>
          ) : null}
          {error ? (
            <Pressable onPress={() => setError(null)}>
              <Text style={styles.error}>{error}</Text>
            </Pressable>
          ) : null}
          {on && canDispatch && orderActive ? (
            <View style={styles.actions}>
              {!open ? (
                <>
                  <Button
                    title={t.ordering.requestCourier}
                    variant="primary"
                    size="sm"
                    loading={request.isPending}
                    onPress={() => setPickProvider(true)}
                    testID="request-courier"
                  />
                  <Button
                    title={t.ordering.assignOwn}
                    variant="outline"
                    size="sm"
                    onPress={() => setPickCourier(true)}
                    testID="assign-courier"
                  />
                </>
              ) : null}
              {open && d?.provider === "own" && d.status === "requested" ? (
                <Button
                  title={t.ordering.assignOwn}
                  variant="primary"
                  size="sm"
                  onPress={() => setPickCourier(true)}
                />
              ) : null}
              {open && d?.provider === "own" && d.status === "assigned" ? (
                <Button
                  title={t.ordering.markPickedUp}
                  variant="primary"
                  size="sm"
                  loading={move.isPending}
                  onPress={() => move.mutate("picked_up")}
                />
              ) : null}
              {open && d?.provider === "own" && d.status === "picked_up" ? (
                <Button
                  title={t.ordering.markDelivered}
                  variant="success"
                  size="sm"
                  loading={move.isPending}
                  onPress={() => move.mutate("delivered")}
                />
              ) : null}
              {open ? (
                <Button
                  title={t.ordering.cancelCourier}
                  variant="outline"
                  size="sm"
                  loading={cancel.isPending}
                  onPress={() => cancel.mutate()}
                />
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}

      <Sheet
        visible={pickProvider}
        title={t.ordering.requestCourier}
        subtitle={order.order_number}
        onClose={() => setPickProvider(false)}
        maxWidth={420}
      >
        <View style={styles.sheetBody}>
          {(["own", "wolt_drive", "glovo_odr"] as CourierProvider[]).map(
            (p) => (
              <Button
                key={p}
                title={(t.ordering.providers as Record<string, string>)[p]}
                variant={p === "own" ? "outline" : "primary"}
                fullWidth
                onPress={() => {
                  setPickProvider(false);
                  if (p === "own") setPickCourier(true);
                  else request.mutate(p);
                }}
                testID={`provider-${p}`}
              />
            ),
          )}
          <Text style={styles.muted}>{t.ordering.providerHint}</Text>
        </View>
      </Sheet>

      <Sheet
        visible={pickCourier}
        title={t.ordering.assignOwn}
        subtitle={order.order_number}
        onClose={() => setPickCourier(false)}
        maxWidth={420}
      >
        <View style={styles.sheetBody}>
          {(couriers.data ?? []).length === 0 ? (
            <Text style={styles.muted}>{t.ordering.noCouriers}</Text>
          ) : (
            (couriers.data ?? []).map((c) => (
              <Button
                key={c.id}
                title={`${c.name}${c.vehicle ? ` · ${c.vehicle}` : ""}${c.is_available ? "" : ` · ${t.ordering.offShift}`}`}
                variant={c.is_available ? "primary" : "outline"}
                fullWidth
                loading={assign.isPending}
                onPress={() => {
                  setPickCourier(false);
                  assign.mutate(c.id);
                }}
              />
            ))
          )}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
    flex: 1,
  },
  when: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  addr: { fontSize: typography.sizes.md, color: colors.foreground },
  muted: { fontSize: 13, color: colors.muted },
  feeRow: { flexDirection: "row", gap: spacing.lg },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 13, color: colors.foreground, flex: 1 },
  error: { fontSize: 13, color: colors.danger },
  link: { flexDirection: "row", alignItems: "center", gap: 4 },
  linkText: { fontSize: 13, color: colors.info, fontWeight: "600" },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  sheetBody: { gap: spacing.sm },
});
