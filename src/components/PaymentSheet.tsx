import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  ledgerErrorCode,
  ledgerErrorMessage,
  recordPayment,
  splitEvenly,
  type RecordPaymentResult,
  type StaffPaymentMethod,
} from "@/api/payments";
import { moduleOn } from "@/api/restaurants";
import { listPayments, type PaymentRow } from "@/api/payments";
import {
  listTerminals,
  startTerminalSale,
  terminalErrorCode,
  type Terminal,
  type TerminalTransaction,
} from "@/api/terminals";
import Button from "@/components/Button";
import Sheet from "@/components/Sheet";
import TerminalWaitSheet from "@/components/TerminalWaitSheet";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/i18n";
import { fixed, money, num, tenderSuggestions } from "@/lib/money";
import { colors, radius, spacing, typography } from "@/theme/tokens";

export type PaymentTarget =
  | { kind: "order"; orderId: string; label: string; balance: string }
  | { kind: "session"; sessionId: string; label: string; balance: string };

interface Props {
  visible: boolean;
  target: PaymentTarget | null;
  onClose: () => void;
  /** Called after each successful payment; `done` when nothing is left to pay. */
  onPaid: (result: RecordPaymentResult, done: boolean) => void;
  onPrint?: (result: RecordPaymentResult) => void;
}

const METHODS: StaffPaymentMethod[] = [
  "cash",
  "card_terminal",
  "voucher",
  "other",
];
const METHOD_ICONS: Record<StaffPaymentMethod, keyof typeof Ionicons.glyphMap> =
  {
    cash: "cash-outline",
    card_terminal: "card-outline",
    voucher: "ticket-outline",
    other: "ellipsis-horizontal-circle-outline",
  };

/**
 * Take money for one order or a whole table: pick a method, pay the full
 * balance, a partial amount or one share of an even split; cash shows the
 * change to give. Every press is one ledger payment.
 */
export default function PaymentSheet({
  visible,
  target,
  onClose,
  onPaid,
  onPrint,
}: Props) {
  const t = useT();
  const qc = useQueryClient();
  const { currentRestaurant } = useAuth();
  const terminalsOn = moduleOn(currentRestaurant, "terminals");
  const terminalsQuery = useQuery({
    queryKey: ["terminals"],
    queryFn: listTerminals,
    enabled: terminalsOn && visible,
    staleTime: 60_000,
  });
  const terminals = (terminalsQuery.data ?? []).filter(
    (x) => x.is_active && x.configured,
  );
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [terminalTx, setTerminalTx] = useState<TerminalTransaction | null>(
    null,
  );
  const [method, setMethod] = useState<StaffPaymentMethod>("cash");
  const [mode, setMode] = useState<"full" | "partial" | "split">("full");
  const [ways, setWays] = useState(2);
  const [shareIndex, setShareIndex] = useState(0);
  const [amount, setAmount] = useState("");
  const [tip, setTip] = useState("");
  const [tendered, setTendered] = useState("");
  const [balance, setBalance] = useState(0);
  const [last, setLast] = useState<RecordPaymentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !target) return;
    const b = num(target.balance);
    setBalance(b);
    setAmount(fixed(b));
    setTip("");
    setTendered("");
    setMode("full");
    setShareIndex(0);
    setLast(null);
    setError(null);
    setTerminalTx(null);
  }, [visible, target]);

  useEffect(() => {
    if (!terminals.length) return;
    if (terminalId && terminals.some((x) => x.id === terminalId)) return;
    setTerminalId((terminals.find((x) => x.is_default) ?? terminals[0]).id);
  }, [terminals, terminalId]);

  const shares = useMemo(() => splitEvenly(balance, ways), [balance, ways]);
  const due = useMemo(() => {
    if (mode === "full") return balance;
    if (mode === "split") return shares[shareIndex] ?? 0;
    return Math.min(num(amount), balance);
  }, [mode, balance, shares, shareIndex, amount]);
  const tipValue = num(tip);
  const totalDue = Math.round((due + tipValue) * 100) / 100;
  const tenderedValue = num(tendered);
  const change =
    method === "cash" && tenderedValue > 0
      ? Math.max(tenderedValue - totalDue, 0)
      : 0;
  const cashShort =
    method === "cash" && tendered !== "" && tenderedValue < totalDue;

  const pay = useMutation({
    mutationFn: () => {
      if (!target) throw new Error("no target");
      const body = {
        method,
        amount: fixed(due),
        tip_amount: tipValue > 0 ? fixed(tipValue) : undefined,
        tendered:
          method === "cash"
            ? fixed(tenderedValue > 0 ? tenderedValue : totalDue)
            : undefined,
        ...(target.kind === "order"
          ? { order_id: target.orderId }
          : { session_id: target.sessionId }),
      };
      return recordPayment(body);
    },
    onSuccess: (result) => {
      setError(null);
      setLast(result);
      const remaining = num(result.balance);
      setBalance(remaining);
      setAmount(fixed(remaining));
      setTendered("");
      setTip("");
      if (mode === "split") setShareIndex((i) => Math.min(i + 1, ways - 1));
      qc.invalidateQueries({ queryKey: ["cash-shift"] });
      onPaid(result, remaining <= 0);
    },
    onError: (err) => {
      const code = ledgerErrorCode(err);
      const known = code
        ? (t.cash.errors as Record<string, string>)[code]
        : undefined;
      setError(known ?? ledgerErrorMessage(err) ?? t.cash.errors.generic);
    },
  });

  const useTerminal =
    terminalsOn && method === "card_terminal" && terminals.length > 0;
  const terminalSale = useMutation({
    mutationFn: () => {
      if (!target || !terminalId) throw new Error("no terminal");
      return startTerminalSale({
        terminal_id: terminalId,
        amount: fixed(due),
        tip_amount: tipValue > 0 ? fixed(tipValue) : undefined,
        ...(target.kind === "order"
          ? { order_id: target.orderId }
          : { session_id: target.sessionId }),
      });
    },
    onSuccess: (tx) => {
      setError(null);
      setTerminalTx(tx);
    },
    onError: (err) => {
      const code = terminalErrorCode(err);
      const known = code
        ? (t.terminals.errors as Record<string, string>)[code]
        : undefined;
      setError(known ?? t.terminals.errors.generic);
    },
  });

  const onTerminalFinished = async (tx: TerminalTransaction) => {
    if (tx.status !== "approved" || !tx.payment_id) return;
    let payment: PaymentRow | undefined;
    try {
      const rows = await listPayments(
        target?.kind === "order"
          ? { order: target.orderId }
          : {
              session:
                target?.kind === "session" ? target.sessionId : undefined,
            },
      );
      payment = rows.results.find((p) => p.id === tx.payment_id);
    } catch {
      payment = undefined;
    }
    const paidNow = num(tx.amount);
    const remaining = Math.max(Math.round((balance - paidNow) * 100) / 100, 0);
    const result: RecordPaymentResult = {
      payment:
        payment ??
        ({
          id: tx.payment_id,
          order: tx.order,
          session: tx.session,
          shift: null,
          amount: tx.amount,
          tip_amount: tx.tip,
          total_amount: tx.total,
          change_given: "0.00",
          payment_method:
            tx.provider === "bog_link"
              ? "online_bog"
              : tx.provider === "tbc_tpay"
                ? "online_tbc"
                : "card_terminal",
          status: "completed",
          receipt_number: tx.receipt_number,
        } as PaymentRow),
      change: "0.00",
      receipt_number: tx.receipt_number,
      balance: fixed(remaining),
      paid_order_numbers:
        remaining <= 0 && tx.order_number ? [tx.order_number] : [],
    };
    setLast(result);
    setBalance(remaining);
    setAmount(fixed(remaining));
    setTip("");
    if (mode === "split") setShareIndex((i) => Math.min(i + 1, ways - 1));
    qc.invalidateQueries({ queryKey: ["cash-shift"] });
    onPaid(result, remaining <= 0);
  };

  if (!target) return null;
  const finished = balance <= 0;

  return (
    <Sheet
      visible={visible}
      title={t.cash.pay}
      subtitle={target.label}
      onClose={onClose}
      testID="payment-sheet"
      footer={
        finished ? (
          <>
            {last && onPrint ? (
              <Button
                title={t.cash.printReceipt}
                variant="outline"
                size="lg"
                fullWidth
                onPress={() => onPrint(last)}
              />
            ) : null}
            <Button
              title={t.cash.done}
              variant="primary"
              size="lg"
              fullWidth
              onPress={onClose}
            />
          </>
        ) : (
          <>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              title={
                useTerminal
                  ? `${t.terminals.cardPayment} · ${money(totalDue)}`
                  : `${t.cash.takePayment} · ${money(totalDue)}`
              }
              variant="success"
              size="lg"
              fullWidth
              disabled={
                pay.isPending ||
                terminalSale.isPending ||
                due <= 0 ||
                cashShort ||
                (useTerminal && !terminalId)
              }
              loading={pay.isPending || terminalSale.isPending}
              onPress={() =>
                useTerminal ? terminalSale.mutate() : pay.mutate()
              }
              testID="take-payment"
            />
          </>
        )
      }
    >
      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>{t.cash.balance}</Text>
        <Text
          style={[
            styles.balanceValue,
            finished && { color: colors.successDark },
          ]}
        >
          {money(balance)}
        </Text>
      </View>

      {last ? (
        <View style={styles.lastBox} testID="payment-result">
          <Ionicons
            name="checkmark-circle"
            size={22}
            color={colors.successDark}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.lastTitle}>
              {t.cash.paymentTaken} · {money(last.payment.total_amount)} ·{" "}
              {(t.cash.methods as Record<string, string>)[
                last.payment.payment_method
              ] ?? last.payment.payment_method}
            </Text>
            <Text style={styles.lastSub}>
              {t.cash.receipt} {last.receipt_number}
              {num(last.change) > 0
                ? ` · ${t.cash.change} ${money(last.change)}`
                : ""}
            </Text>
          </View>
        </View>
      ) : null}

      {finished ? null : (
        <>
          <View style={styles.methods}>
            {METHODS.map((m) => (
              <Pressable
                key={m}
                onPress={() => setMethod(m)}
                style={[styles.method, method === m && styles.methodActive]}
                accessibilityRole="button"
                testID={`method-${m}`}
              >
                <Ionicons
                  name={METHOD_ICONS[m]}
                  size={22}
                  color={method === m ? colors.primary : colors.slate600}
                />
                <Text
                  style={[
                    styles.methodText,
                    method === m && styles.methodTextActive,
                  ]}
                >
                  {t.cash.methods[m]}
                </Text>
              </Pressable>
            ))}
          </View>

          {terminalsOn && method === "card_terminal" ? (
            <View style={styles.terminalRow} testID="terminal-picker">
              {terminals.length === 0 ? (
                <Text style={styles.terminalHint}>
                  {t.terminals.noTerminals}
                </Text>
              ) : (
                terminals.map((x: Terminal) => (
                  <Pressable
                    key={x.id}
                    onPress={() => setTerminalId(x.id)}
                    style={[
                      styles.terminalChip,
                      terminalId === x.id && styles.terminalChipActive,
                    ]}
                    testID={`terminal-${x.id}`}
                  >
                    <Ionicons
                      name={x.is_link ? "qr-code-outline" : "card-outline"}
                      size={16}
                      color={
                        terminalId === x.id ? colors.primary : colors.slate600
                      }
                    />
                    <Text
                      style={[
                        styles.terminalChipText,
                        terminalId === x.id && styles.terminalChipTextActive,
                      ]}
                    >
                      {x.name}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          ) : null}

          <View style={styles.modes}>
            <ModeChip
              active={mode === "full"}
              label={t.cash.fullAmount}
              onPress={() => setMode("full")}
            />
            <ModeChip
              active={mode === "split"}
              label={t.cash.splitEvenly}
              onPress={() => setMode("split")}
            />
            <ModeChip
              active={mode === "partial"}
              label={t.cash.partial}
              onPress={() => setMode("partial")}
            />
          </View>

          {mode === "split" ? (
            <View style={styles.splitBox}>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => setWays((w) => Math.max(2, w - 1))}
                  style={styles.stepBtn}
                >
                  <Ionicons name="remove" size={22} color={colors.foreground} />
                </Pressable>
                <Text style={styles.stepValue}>
                  {ways} {t.cash.ways}
                </Text>
                <Pressable
                  onPress={() => setWays((w) => Math.min(20, w + 1))}
                  style={styles.stepBtn}
                >
                  <Ionicons name="add" size={22} color={colors.foreground} />
                </Pressable>
              </View>
              <View style={styles.shares}>
                {shares.map((s, i) => (
                  <Pressable
                    key={i}
                    onPress={() => setShareIndex(i)}
                    style={[
                      styles.share,
                      i === shareIndex && styles.shareActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.shareText,
                        i === shareIndex && styles.shareTextActive,
                      ]}
                    >
                      {i + 1}: {money(s)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {mode === "partial" ? (
            <Field label={t.cash.amount}>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                style={styles.bigInput}
                testID="partial-amount"
              />
            </Field>
          ) : null}

          <Field label={t.cash.tip}>
            <TextInput
              value={tip}
              onChangeText={setTip}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.slate400}
              style={styles.input}
            />
          </Field>

          {method === "cash" ? (
            <Field label={t.cash.tendered}>
              <View style={styles.chips}>
                {tenderSuggestions(totalDue).map((v) => (
                  <Pressable
                    key={v}
                    onPress={() => setTendered(fixed(v))}
                    style={[
                      styles.chip,
                      tenderedValue === v && styles.chipActive,
                    ]}
                    testID={`tender-${v}`}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        tenderedValue === v && styles.chipTextActive,
                      ]}
                    >
                      {v === Math.ceil(totalDue * 100) / 100
                        ? t.cash.exact
                        : `${v} ₾`}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={tendered}
                onChangeText={setTendered}
                keyboardType="decimal-pad"
                placeholder={fixed(totalDue)}
                placeholderTextColor={colors.slate400}
                style={styles.bigInput}
                testID="tendered"
              />
              <View style={styles.changeRow}>
                <Text style={styles.changeLabel}>{t.cash.change}</Text>
                <Text
                  style={[
                    styles.changeValue,
                    cashShort && { color: colors.danger },
                  ]}
                >
                  {cashShort
                    ? t.cash.errors.insufficient_tendered
                    : money(change)}
                </Text>
              </View>
            </Field>
          ) : null}
        </>
      )}
      <TerminalWaitSheet
        tx={terminalTx}
        onClose={() => setTerminalTx(null)}
        onFinished={(tx) => {
          setTerminalTx(null);
          onTerminalFinished(tx);
        }}
      />
    </Sheet>
  );
}

function ModeChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.modeChip, active && styles.modeChipActive]}
    >
      <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.slate50,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  balanceLabel: { fontSize: typography.sizes.md, color: colors.muted },
  balanceValue: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  lastBox: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    backgroundColor: colors.successTint,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  lastTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  lastSub: {
    fontSize: typography.sizes.sm,
    color: colors.mutedStrong,
    marginTop: 2,
  },
  methods: { flexDirection: "row", gap: spacing.sm },
  terminalRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  terminalHint: { fontSize: 13, color: colors.muted },
  terminalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  terminalChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  terminalChipText: { fontSize: 13, color: colors.slate600 },
  terminalChipTextActive: { color: colors.primary, fontWeight: "600" },
  method: {
    flex: 1,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  methodActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  methodText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  methodTextActive: { color: colors.primary },
  modes: { flexDirection: "row", gap: spacing.sm },
  modeChip: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  modeChipActive: {
    backgroundColor: colors.slate900,
    borderColor: colors.slate900,
  },
  modeChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  modeChipTextActive: { color: colors.white },
  splitBox: { gap: spacing.sm },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  shares: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  share: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  shareText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  shareTextActive: { color: colors.primary },
  fieldLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.lg,
    color: colors.foreground,
  },
  bigInput: {
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: 44,
    minWidth: 72,
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
  changeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  changeLabel: { fontSize: typography.sizes.md, color: colors.muted },
  changeValue: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.successDark,
  },
  error: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
});
