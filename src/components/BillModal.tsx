import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getSessionBill } from "@/api/sessions";
import Button from "@/components/Button";
import Sheet from "@/components/Sheet";
import { useT } from "@/i18n";
import { money, num } from "@/lib/money";
import { colors, radius, spacing, typography } from "@/theme/tokens";

interface Props {
  sessionId: string | null;
  tableNumber?: string;
  canPay: boolean;
  onClose: () => void;
  onPayAll: (balance: string) => void;
  onPayOrder: (orderId: string, orderNumber: string, balance: string) => void;
}

/** The table's bill: every order with paid / balance, payments taken, and Pay buttons. */
export default function BillModal({
  sessionId,
  tableNumber,
  canPay,
  onClose,
  onPayAll,
  onPayOrder,
}: Props) {
  const t = useT();
  const router = useRouter();
  const bill = useQuery({
    queryKey: ["session-bill", sessionId],
    queryFn: () => getSessionBill(sessionId!),
    enabled: !!sessionId,
    refetchInterval: 8_000,
  });
  const data = bill.data;

  return (
    <Sheet
      visible={!!sessionId}
      title={`${t.cash.bill} · ${t.tablesScreen.tableLabel} ${tableNumber ?? data?.table_number ?? ""}`}
      onClose={onClose}
      testID="bill-modal"
      footer={
        data && canPay && num(data.balance) > 0 ? (
          <Button
            title={`${t.cash.pay} ${money(data.balance)}`}
            variant="success"
            size="lg"
            fullWidth
            onPress={() => onPayAll(data.balance)}
          />
        ) : undefined
      }
    >
      {data ? (
        <>
          {data.orders.map((o) => (
            <View key={o.id} style={styles.order}>
              <Pressable
                style={{ flex: 1 }}
                onPress={() => router.push(`/orders/${o.id}`)}
              >
                <Text style={styles.orderNumber}>
                  {o.order_number} · {o.items_count}× · {o.customer_name}
                </Text>
                <Text style={styles.orderSub}>
                  {t.cash.total} {money(o.total)}
                  {num(o.discount_amount) > 0
                    ? ` · ${t.cash.discount} −${money(o.discount_amount)}`
                    : ""}
                </Text>
              </Pressable>
              {o.is_paid ? (
                <View style={styles.paidBadge}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={colors.successDark}
                  />
                  <Text style={styles.paidText}>{t.cash.paid}</Text>
                </View>
              ) : canPay ? (
                <Button
                  title={`${t.cash.pay} ${money(o.balance)}`}
                  variant="outline"
                  size="sm"
                  onPress={() => onPayOrder(o.id, o.order_number, o.balance)}
                />
              ) : (
                <Text style={styles.balanceText}>{money(o.balance)}</Text>
              )}
            </View>
          ))}
          <View style={styles.totals}>
            <Row label={t.cash.total} value={money(data.grand_total)} />
            <Row label={t.cash.paid} value={money(data.paid_total)} />
            <Row label={t.cash.balance} value={money(data.balance)} strong />
          </View>
          {data.payments.length ? (
            <View style={{ gap: 4 }}>
              <Text style={styles.section}>{t.cash.payments}</Text>
              {data.payments.map((p) => (
                <View key={p.id} style={styles.payment}>
                  <Text style={styles.paymentText}>
                    {(t.cash.methods as Record<string, string>)[
                      p.payment_method
                    ] ?? p.payment_method}{" "}
                    · {p.receipt_number}
                  </Text>
                  <Text style={styles.paymentAmount}>{money(p.amount)}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <Text style={styles.orderSub}>{t.common.loading}</Text>
      )}
    </Sheet>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text
        style={[
          styles.rowLabel,
          strong && {
            color: colors.foreground,
            fontWeight: typography.weights.bold,
          },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.rowValue,
          strong && { color: colors.primary, fontSize: typography.sizes.xl },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  order: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  orderNumber: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  orderSub: {
    fontSize: typography.sizes.sm,
    color: colors.muted,
    marginTop: 2,
  },
  paidBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  paidText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.successDark,
  },
  balanceText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  totals: {
    backgroundColor: colors.slate50,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLabel: { fontSize: typography.sizes.sm, color: colors.muted },
  rowValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  section: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  payment: { flexDirection: "row", justifyContent: "space-between" },
  paymentText: { fontSize: typography.sizes.sm, color: colors.foreground },
  paymentAmount: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
});
