import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  applyOrderDiscount,
  applyPromoCode,
  removePromoCode,
  compOrderItem,
  discountOrderItem,
  getOrder,
  moveOrder,
  orderErrorCode,
  removeOrderDiscount,
  resolveOrderStatus,
  splitOrder,
  updateOrderStatus,
  voidOrderItem,
  type OrderItem,
  type OrderStatus,
} from "@/api/orders";
import type { RecordPaymentResult } from "@/api/payments";
import { can, moduleOn } from "@/api/restaurants";
import Button from "@/components/Button";
import DeliveryPanel from "@/components/DeliveryPanel";
import DiscountSheet, { type DiscountInput } from "@/components/DiscountSheet";
import PromoCodeSheet from "@/components/PromoCodeSheet";
import { lookupCustomer } from "@/api/crm";
import MoveTableSheet from "@/components/MoveTableSheet";
import PaymentSheet, { type PaymentTarget } from "@/components/PaymentSheet";
import ReasonSheet from "@/components/ReasonSheet";
import SplitItemsSheet from "@/components/SplitItemsSheet";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/i18n";
import { money, num } from "@/lib/money";
import { printReceiptAnywhere } from "@/lib/receipt";
import { usePrinters } from "@/lib/usePrinters";
import { useShift } from "@/lib/useShift";
import { colors, radius, shadows, spacing, typography } from "@/theme/tokens";

type ItemAction = {
  kind: "void" | "comp" | "discount";
  item: OrderItem;
} | null;

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useT();
  const { restaurantSlug, currentRestaurant } = useAuth();
  const { canPay, canDiscount, enabled: cashOn } = useShift();
  const { receiptPrinters } = usePrinters();
  const manager = can(currentRestaurant, "cash", "update");
  const canSplit = can(currentRestaurant, "orders", "update");
  const [payTarget, setPayTarget] = useState<PaymentTarget | null>(null);
  const [orderDiscount, setOrderDiscount] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const promoOn = moduleOn(currentRestaurant, "promotions");
  const crmOn = moduleOn(currentRestaurant, "crm");
  const [splitOpen, setSplitOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [itemAction, setItemAction] = useState<ItemAction>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ADVANCE: Partial<
    Record<OrderStatus, { next: OrderStatus; label: string }>
  > = {
    pending: { next: "confirmed", label: t.orderDetail.actions.accept },
    confirmed: { next: "preparing", label: t.orderDetail.actions.startPrep },
    preparing: { next: "ready", label: t.orderDetail.actions.markReady },
    ready: { next: "served", label: t.orderDetail.actions.markServed },
    served: { next: "completed", label: t.orderDetail.actions.complete },
  };

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(id!),
    enabled: !!id,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
  const guest = useQuery({
    queryKey: ["crm-lookup", order?.customer_phone],
    queryFn: () => lookupCustomer(order?.customer_phone ?? ""),
    enabled: crmOn && !!order?.customer_phone,
    staleTime: 60_000,
  });

  const invalidateOnOrderChange = () => {
    queryClient.invalidateQueries({ queryKey: ["order", id] });
    queryClient.invalidateQueries({ queryKey: ["orders-board"] });
    queryClient.invalidateQueries({ queryKey: ["orders-history"] });
    queryClient.invalidateQueries({ queryKey: ["kitchen-board"] });
    queryClient.invalidateQueries({ queryKey: ["active-sessions"] });
    queryClient.invalidateQueries({ queryKey: ["session-bill"] });
    queryClient.invalidateQueries({ queryKey: ["cash-shift"] });
    // pre_order_summary on reservation list cards is derived from Order.total.
    queryClient.invalidateQueries({ queryKey: ["reservations-today"] });
    queryClient.invalidateQueries({ queryKey: ["reservations-upcoming"] });
  };

  const errorText = (err: unknown) => {
    const code = orderErrorCode(err);
    const known = code
      ? (t.cash.errors as Record<string, string>)[code]
      : undefined;
    return known ?? t.cash.errors.generic;
  };

  const advance = useMutation({
    mutationFn: (next: OrderStatus) => updateOrderStatus(id!, next),
    onSuccess: invalidateOnOrderChange,
  });

  const cancel = useMutation({
    mutationFn: () => updateOrderStatus(id!, "cancelled"),
    onSuccess: () => {
      invalidateOnOrderChange();
      router.back();
    },
  });

  const finish = useMutation({
    mutationFn: async () => {
      const fresh = await getOrder(id!);
      try {
        await printReceiptAnywhere({
          order: fresh,
          receiptPrinters,
          restaurantSlug,
          restaurantName: currentRestaurant?.name ?? null,
          fiscalOn: moduleOn(currentRestaurant, "fiscal"),
        });
      } catch {
        // printing failure shouldn't block the status transition
      }
      return updateOrderStatus(id!, "completed");
    },
    onSuccess: invalidateOnOrderChange,
  });

  const reprint = useMutation({
    mutationFn: async () => {
      const fresh = await getOrder(id!);
      await printReceiptAnywhere({
        order: fresh,
        receiptPrinters,
        restaurantSlug,
        restaurantName: currentRestaurant?.name ?? null,
        fiscalOn: moduleOn(currentRestaurant, "fiscal"),
      });
    },
  });

  const discount = useMutation({
    mutationFn: (input: DiscountInput) => applyOrderDiscount(id!, input),
    onSuccess: () => {
      setOrderDiscount(false);
      setError(null);
      invalidateOnOrderChange();
    },
    onError: (err) => setError(errorText(err)),
  });
  const promo = useMutation({
    mutationFn: (code: string) => applyPromoCode(id!, code),
    onSuccess: () => {
      setPromoOpen(false);
      setPromoError(null);
      invalidateOnOrderChange();
    },
    onError: (err: unknown) => {
      const data = (
        err as { response?: { data?: { error?: { message?: string } } } }
      ).response?.data;
      setPromoError(data?.error?.message ?? t.delivery.failed);
    },
  });
  const clearPromo = useMutation({
    mutationFn: () => removePromoCode(id!),
    onSuccess: () => invalidateOnOrderChange(),
  });
  const clearDiscount = useMutation({
    mutationFn: (discountId?: string) => removeOrderDiscount(id!, discountId),
    onSuccess: invalidateOnOrderChange,
    onError: (err) => setError(errorText(err)),
  });
  const itemMutation = useMutation({
    mutationFn: async ({
      action,
      reason,
      discountInput,
    }: {
      action: NonNullable<ItemAction>;
      reason?: { reason_id: string | null; reason_text: string };
      discountInput?: DiscountInput;
    }) => {
      if (action.kind === "void")
        return voidOrderItem(id!, action.item.id, reason!);
      if (action.kind === "comp")
        return compOrderItem(id!, action.item.id, reason!);
      return discountOrderItem(id!, action.item.id, discountInput!);
    },
    onSuccess: () => {
      setItemAction(null);
      setExpandedItem(null);
      setError(null);
      invalidateOnOrderChange();
    },
    onError: (err) => setError(errorText(err)),
  });
  const split = useMutation({
    mutationFn: (itemIds: string[]) => splitOrder(id!, { item_ids: itemIds }),
    onSuccess: (result) => {
      setSplitOpen(false);
      setError(null);
      invalidateOnOrderChange();
      router.push(`/orders/${result.new_order.id}`);
    },
    onError: (err) => setError(errorText(err)),
  });
  const move = useMutation({
    mutationFn: (tableId: string) => moveOrder(id!, tableId),
    onSuccess: () => {
      setMoveOpen(false);
      setError(null);
      invalidateOnOrderChange();
    },
    onError: (err) => setError(errorText(err)),
  });

  async function printLast(result: RecordPaymentResult) {
    try {
      const fresh = await getOrder(id!);
      await printReceiptAnywhere({
        order: fresh,
        payment: result.payment,
        receiptPrinters,
        restaurantSlug,
        restaurantName: currentRestaurant?.name ?? null,
        fiscalOn: moduleOn(currentRestaurant, "fiscal"),
      });
    } catch {
      /* never block the till on printing */
    }
  }

  if (isLoading || !order) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const status = resolveOrderStatus(order.status);
  const next = ADVANCE[status];
  const isTerminal = status === "completed" || status === "cancelled";
  const balance = num(order.balance ?? order.total);
  const paid = num(order.paid_amount);
  const moneyOpen = !isTerminal && paid <= 0;
  const liveNet =
    num(order.subtotal) -
    (order.items ?? []).reduce(
      (s, i) => s + (i.status === "cancelled" ? 0 : num(i.discount_amount)),
      0,
    );

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← {t.reservationDetails.back}</Text>
        </Pressable>
        <StatusBadge status={status} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.orderNumber}>{order.order_number}</Text>
          <Text style={styles.meta}>
            {order.order_type?.replace("_", " ")} ·{" "}
            {order.table_number ? `Table ${order.table_number}` : "—"}
          </Text>
          {order.customer_name ? (
            <Text style={styles.guest}>{order.customer_name}</Text>
          ) : null}
          {crmOn && order.customer_phone && guest.data ? (
            <Text style={styles.muted} testID="guest-badge">
              {guest.data.visits > 0
                ? `${t.crm.visits.replace("{n}", String(guest.data.visits))} · ${t.crm.spend.replace("{amount}", money(guest.data.total_spend))}`
                : t.crm.newGuest}
              {guest.data.days_since_visit !== null && guest.data.visits > 0
                ? ` · ${t.crm.lastVisit.replace("{days}", String(guest.data.days_since_visit))}`
                : ""}
              {guest.data.tags?.length
                ? ` · ${guest.data.tags.join(", ")}`
                : ""}
              {guest.data.marketing_opt_in ? ` · ${t.crm.optedIn}` : ""}
            </Text>
          ) : null}
          {order.customer_phone ? (
            <Text style={styles.muted}>{order.customer_phone}</Text>
          ) : null}
          {order.customer_notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>{t.orderDetail.notes}</Text>
              <Text style={styles.notesText}>{order.customer_notes}</Text>
            </View>
          ) : null}
        </View>

        <DeliveryPanel order={order} onChanged={invalidateOnOrderChange} />

        {error ? (
          <Pressable onPress={() => setError(null)} style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </Pressable>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t.orderDetail.items}</Text>
          {order.items?.length === 0 ? (
            <Text style={styles.muted}>No items attached.</Text>
          ) : (
            order.items.map((item) => {
              const voided = item.status === "cancelled";
              const expanded = expandedItem === item.id;
              return (
                <View key={item.id}>
                  <Pressable
                    onPress={() =>
                      !voided &&
                      !isTerminal &&
                      setExpandedItem(expanded ? null : item.id)
                    }
                    style={styles.itemRow}
                    testID={`item-${item.item_name}`}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, voided && styles.voided]}>
                        {item.quantity ?? 1}× {item.item_name}
                      </Text>
                      {item.modifiers?.length > 0 ? (
                        <Text style={styles.itemSub}>
                          {item.modifiers
                            .map((m) => m.modifier_name)
                            .join(", ")}
                        </Text>
                      ) : null}
                      {item.special_instructions ? (
                        <Text style={styles.itemSub}>
                          {item.special_instructions}
                        </Text>
                      ) : null}
                      {voided ? (
                        <Text style={styles.voidReason}>
                          {t.cash.voided}
                          {item.void_reason_label
                            ? ` · ${item.void_reason_label}`
                            : ""}
                        </Text>
                      ) : item.is_comped ? (
                        <Text style={styles.compLabel}>
                          {t.cash.comped}
                          {item.discount_reason_label
                            ? ` · ${item.discount_reason_label}`
                            : ""}
                        </Text>
                      ) : num(item.discount_amount) > 0 ? (
                        <Text style={styles.compLabel}>
                          {t.cash.discount} −{money(item.discount_amount)}
                          {item.discount_reason_label
                            ? ` · ${item.discount_reason_label}`
                            : ""}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.itemPrice, voided && styles.voided]}>
                        {money(
                          voided
                            ? item.total_price
                            : (item.net_price ?? item.total_price),
                        )}
                      </Text>
                      {!voided && !isTerminal ? (
                        <Ionicons
                          name={expanded ? "chevron-up" : "ellipsis-horizontal"}
                          size={18}
                          color={colors.slate400}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                  {expanded ? (
                    <View style={styles.itemActions}>
                      <Button
                        title={t.cash.void}
                        variant="danger"
                        size="sm"
                        onPress={() => setItemAction({ kind: "void", item })}
                      />
                      {cashOn && canDiscount && moneyOpen ? (
                        <>
                          <Button
                            title={t.cash.comp}
                            variant="outline"
                            size="sm"
                            onPress={() =>
                              setItemAction({ kind: "comp", item })
                            }
                          />
                          <Button
                            title={t.cash.discount}
                            variant="outline"
                            size="sm"
                            onPress={() =>
                              setItemAction({ kind: "discount", item })
                            }
                          />
                        </>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
          <View style={styles.totalsDivider} />
          <Row label={t.orderDetail.subtotal} value={money(order.subtotal)} />
          {(order.discounts ?? []).map((d) => (
            <View key={d.id} style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                {t.cash.discount} · {d.label}
                {d.mode === "percent" ? ` (${num(d.value)}%)` : ""}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <Text style={styles.totalValue}>−{money(d.amount)}</Text>
                {d.kind === "promo" && promoOn && moneyOpen ? (
                  <Pressable
                    onPress={() => clearPromo.mutate()}
                    accessibilityLabel={t.cash.removeDiscount}
                  >
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={colors.danger}
                    />
                  </Pressable>
                ) : null}
                {d.kind === "manual" && cashOn && canDiscount && moneyOpen ? (
                  <Pressable
                    onPress={() => clearDiscount.mutate(d.id)}
                    accessibilityLabel={t.cash.removeDiscount}
                  >
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={colors.danger}
                    />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
          {num(order.discount_amount) > 0 && !(order.discounts ?? []).length ? (
            <Row
              label={t.cash.discount}
              value={`−${money(order.discount_amount)}`}
            />
          ) : null}
          {num(order.tax_amount) > 0 ? (
            <Row label={t.orderDetail.tax} value={money(order.tax_amount)} />
          ) : null}
          {num(order.service_charge) > 0 ? (
            <Row
              label={t.orderDetail.serviceCharge}
              value={money(order.service_charge)}
            />
          ) : null}
          {num(order.tip_amount) > 0 ? (
            <Row label={t.orderDetail.tip} value={money(order.tip_amount)} />
          ) : null}
          {num(order.delivery_fee) > 0 ? (
            <Row
              label={t.ordering.deliveryFee}
              value={money(order.delivery_fee)}
            />
          ) : null}
          {num(order.packaging_fee) > 0 ? (
            <Row
              label={t.ordering.packaging}
              value={money(order.packaging_fee)}
            />
          ) : null}
          <Row
            label={t.orderDetail.total}
            value={money(order.total)}
            emphasised
          />
          {paid > 0 || (order.payments ?? []).length ? (
            <>
              {(order.payments ?? []).map((p) => (
                <Row
                  key={p.id}
                  label={`${t.cash.paid} · ${(t.cash.methods as Record<string, string>)[p.payment_method] ?? p.payment_method}${p.receipt_number ? ` · ${p.receipt_number}` : ""}`}
                  value={money(p.amount)}
                />
              ))}
              <Row
                label={t.cash.balance}
                value={money(balance)}
                emphasised
                tone={balance <= 0 ? "ok" : undefined}
              />
            </>
          ) : null}
        </View>

        {!isTerminal ? (
          <View style={styles.actions}>
            {cashOn && canPay && balance > 0 ? (
              <Button
                title={`${t.cash.pay} ${money(balance)}`}
                variant="success"
                size="lg"
                fullWidth
                testID="pay-order"
                onPress={() =>
                  setPayTarget({
                    kind: "order",
                    orderId: order.id,
                    label: order.order_number,
                    balance: String(balance),
                  })
                }
              />
            ) : null}
            <View style={styles.actionRow}>
              {cashOn && canDiscount && moneyOpen ? (
                <View style={{ flex: 1 }}>
                  <Button
                    title={t.cash.discount}
                    variant="outline"
                    fullWidth
                    onPress={() => setOrderDiscount(true)}
                  />
                </View>
              ) : null}
              {promoOn && moneyOpen ? (
                <View style={{ flex: 1 }}>
                  <Button
                    title={t.cash.promoCode}
                    variant="outline"
                    fullWidth
                    onPress={() => {
                      setPromoError(null);
                      setPromoOpen(true);
                    }}
                    testID="promo-code-button"
                  />
                </View>
              ) : null}
              {cashOn &&
              canSplit &&
              moneyOpen &&
              (order.items ?? []).filter((i) => i.status !== "cancelled")
                .length > 1 ? (
                <View style={{ flex: 1 }}>
                  <Button
                    title={t.cash.split}
                    variant="outline"
                    fullWidth
                    onPress={() => setSplitOpen(true)}
                  />
                </View>
              ) : null}
              {canSplit && order.order_type === "dine_in" ? (
                <View style={{ flex: 1 }}>
                  <Button
                    title={t.cash.move}
                    variant="outline"
                    fullWidth
                    onPress={() => setMoveOpen(true)}
                  />
                </View>
              ) : null}
            </View>
            {status === "served" ? (
              <Button
                title={t.ordersScreen.finish}
                variant="primary"
                size="lg"
                fullWidth
                loading={finish.isPending}
                onPress={() => finish.mutate()}
              />
            ) : next ? (
              <Button
                title={next.label}
                variant="success"
                size="lg"
                fullWidth
                loading={advance.isPending}
                onPress={() => advance.mutate(next.next)}
              />
            ) : null}
            <Button
              title={t.orderDetail.cancelOrder}
              variant="danger"
              size="lg"
              fullWidth
              loading={cancel.isPending}
              onPress={() => cancel.mutate()}
            />
          </View>
        ) : null}

        {status === "completed" ? (
          <View style={styles.actions}>
            <Button
              title={t.ordersScreen.printReceipt}
              variant="outline"
              size="lg"
              fullWidth
              loading={reprint.isPending}
              onPress={() => reprint.mutate()}
            />
          </View>
        ) : null}
      </ScrollView>

      <PaymentSheet
        visible={!!payTarget}
        target={payTarget}
        onClose={() => {
          setPayTarget(null);
          invalidateOnOrderChange();
        }}
        onPaid={() => invalidateOnOrderChange()}
        onPrint={printLast}
      />
      <PromoCodeSheet
        visible={promoOpen}
        subtitle={order.order_number}
        loading={promo.isPending}
        error={promoError}
        onClose={() => setPromoOpen(false)}
        onConfirm={(code) => promo.mutate(code)}
      />
      <DiscountSheet
        visible={orderDiscount}
        title={t.cash.discount}
        subtitle={order.order_number}
        base={liveNet}
        manager={manager}
        loading={discount.isPending}
        error={orderDiscount ? error : null}
        onClose={() => setOrderDiscount(false)}
        onConfirm={(input) => discount.mutate(input)}
      />
      <DiscountSheet
        visible={itemAction?.kind === "discount"}
        title={t.cash.itemDiscount}
        subtitle={
          itemAction
            ? `${itemAction.item.quantity ?? 1}× ${itemAction.item.item_name}`
            : undefined
        }
        base={itemAction ? num(itemAction.item.total_price) : 0}
        manager={manager}
        loading={itemMutation.isPending}
        error={itemAction?.kind === "discount" ? error : null}
        onClose={() => setItemAction(null)}
        onConfirm={(input) =>
          itemAction &&
          itemMutation.mutate({ action: itemAction, discountInput: input })
        }
      />
      <ReasonSheet
        visible={itemAction?.kind === "void" || itemAction?.kind === "comp"}
        kind={itemAction?.kind === "comp" ? "comp" : "void"}
        title={itemAction?.kind === "comp" ? t.cash.comp : t.cash.void}
        subtitle={
          itemAction
            ? `${itemAction.item.quantity ?? 1}× ${itemAction.item.item_name}`
            : undefined
        }
        confirmLabel={itemAction?.kind === "comp" ? t.cash.comp : t.cash.void}
        danger={itemAction?.kind === "void"}
        manager={manager}
        loading={itemMutation.isPending}
        error={itemAction && itemAction.kind !== "discount" ? error : null}
        onClose={() => setItemAction(null)}
        onConfirm={(reason) =>
          itemAction && itemMutation.mutate({ action: itemAction, reason })
        }
      />
      <SplitItemsSheet
        visible={splitOpen}
        order={order}
        loading={split.isPending}
        error={splitOpen ? error : null}
        onClose={() => setSplitOpen(false)}
        onConfirm={(ids) => split.mutate(ids)}
      />
      <MoveTableSheet
        visible={moveOpen}
        currentTableId={order.table ?? null}
        loading={move.isPending}
        error={moveOpen ? error : null}
        onClose={() => setMoveOpen(false)}
        onPick={(table) => move.mutate(table.id)}
      />
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  emphasised = false,
  tone,
}: {
  label: string;
  value: string;
  emphasised?: boolean;
  tone?: "ok";
}) {
  return (
    <View style={styles.totalRow}>
      <Text
        style={[
          styles.totalLabel,
          emphasised && { fontWeight: typography.weights.bold },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.totalValue,
          emphasised && {
            fontSize: typography.sizes.xl,
            color: tone === "ok" ? colors.successDark : colors.primary,
            fontWeight: typography.weights.bold,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  back: { paddingVertical: spacing.sm },
  backText: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
    maxWidth: 800,
    width: "100%",
    alignSelf: "center",
  },
  header: { gap: spacing.xs },
  orderNumber: {
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  meta: { fontSize: typography.sizes.md, color: colors.muted },
  guest: {
    marginTop: spacing.sm,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  muted: { fontSize: typography.sizes.sm, color: colors.muted },
  notesBox: {
    marginTop: spacing.md,
    backgroundColor: colors.warningTint,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  notesLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.warning,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  notesText: {
    fontSize: typography.sizes.md,
    color: colors.foreground,
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: colors.dangerTint,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { color: colors.danger, fontWeight: typography.weights.semibold },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  itemName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  itemSub: { fontSize: typography.sizes.sm, color: colors.muted, marginTop: 2 },
  itemPrice: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  voided: { textDecorationLine: "line-through", color: colors.slate400 },
  voidReason: {
    fontSize: typography.sizes.xs,
    color: colors.danger,
    marginTop: 2,
    fontWeight: typography.weights.semibold,
  },
  compLabel: {
    fontSize: typography.sizes.xs,
    color: colors.successDark,
    marginTop: 2,
    fontWeight: typography.weights.semibold,
  },
  itemActions: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.lg,
    backgroundColor: colors.slate50,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  totalsDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  totalLabel: { flex: 1, fontSize: typography.sizes.md, color: colors.muted },
  totalValue: {
    fontSize: typography.sizes.md,
    color: colors.foreground,
    fontWeight: typography.weights.semibold,
  },
  actions: { gap: spacing.md },
  actionRow: { flexDirection: "row", gap: spacing.sm },
});
