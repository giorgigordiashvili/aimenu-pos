import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import {
  cancelTerminalTransaction,
  confirmTerminalTransaction,
  declineTerminalTransaction,
  getTerminalTransaction,
  sendTerminalLink,
  terminalErrorCode,
  type TerminalTransaction,
} from "@/api/terminals";
import Button from "@/components/Button";
import Sheet from "@/components/Sheet";
import { useT } from "@/i18n";
import { money } from "@/lib/money";
import { colors, radius, spacing, typography } from "@/theme/tokens";

interface Props {
  tx: TerminalTransaction | null;
  onClose: () => void;
  /** The transaction reached a final state (approved / declined / ...). */
  onFinished: (tx: TerminalTransaction) => void;
}

/**
 * "Waiting for the terminal" panel: polls the transaction, shows a QR /
 * link for pay-by-link terminals, lets the cashier confirm a physical
 * terminal or cancel.
 */
export default function TerminalWaitSheet({ tx, onClose, onFinished }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const [cardMask, setCardMask] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);

  const live = useQuery({
    queryKey: ["terminal-tx", tx?.id],
    queryFn: () => getTerminalTransaction(tx!.id),
    enabled: !!tx,
    initialData: tx ?? undefined,
    refetchInterval: (q) => (q.state.data?.is_open ? 2000 : false),
  });
  const current = live.data ?? tx;

  useEffect(() => {
    if (!current) return;
    if (!current.is_open) {
      onFinished(current);
      qc.invalidateQueries({ queryKey: ["cash-shift"] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.status]);

  useEffect(() => {
    if (!current?.expires_at || !current.is_open) {
      setLeft(null);
      return;
    }
    const tick = () =>
      setLeft(
        Math.max(
          0,
          Math.round(
            (new Date(current.expires_at!).getTime() - Date.now()) / 1000,
          ),
        ),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [current?.expires_at, current?.is_open]);

  const fail = (err: unknown) => {
    const code = terminalErrorCode(err);
    const known = code
      ? (t.terminals.errors as Record<string, string>)[code]
      : undefined;
    setError(known ?? t.terminals.errors.generic);
  };
  const refresh = (next: TerminalTransaction) => {
    setError(null);
    qc.setQueryData(["terminal-tx", next.id], next);
  };
  const confirm = useMutation({
    mutationFn: () =>
      confirmTerminalTransaction(tx!.id, { card_mask: cardMask.trim() }),
    onSuccess: refresh,
    onError: fail,
  });
  const decline = useMutation({
    mutationFn: () =>
      declineTerminalTransaction(tx!.id, "Declined at the terminal"),
    onSuccess: refresh,
    onError: fail,
  });
  const cancel = useMutation({
    mutationFn: () => cancelTerminalTransaction(tx!.id),
    onSuccess: refresh,
    onError: fail,
  });
  const send = useMutation({
    mutationFn: () => sendTerminalLink(tx!.id, phone.trim()),
    onSuccess: refresh,
    onError: fail,
  });

  if (!tx || !current) return null;
  const manual = current.provider === "manual";
  const link =
    current.provider === "bog_link" || current.provider === "tbc_tpay";
  const statusText =
    (t.terminals.status as Record<string, string>)[current.status] ??
    current.status_display;

  return (
    <Sheet
      visible={!!tx}
      title={`${t.terminals.cardPayment} · ${money(current.total)}`}
      subtitle={`${current.terminal_name}${current.order_number ? ` · ${current.order_number}` : ""}`}
      onClose={onClose}
      testID="terminal-wait-sheet"
      maxWidth={480}
      footer={
        current.is_open ? (
          <>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {manual ? (
              <Button
                title={t.terminals.confirmApproved}
                variant="success"
                size="lg"
                fullWidth
                loading={confirm.isPending}
                onPress={() => confirm.mutate()}
                testID="terminal-confirm"
              />
            ) : null}
            <View style={styles.row}>
              {manual ? (
                <View style={{ flex: 1 }}>
                  <Button
                    title={t.terminals.declined}
                    variant="danger"
                    fullWidth
                    loading={decline.isPending}
                    onPress={() => decline.mutate()}
                  />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <Button
                  title={t.terminals.cancel}
                  variant="outline"
                  fullWidth
                  loading={cancel.isPending}
                  onPress={() => cancel.mutate()}
                  testID="terminal-cancel"
                />
              </View>
            </View>
          </>
        ) : (
          <Button
            title={t.cash.done}
            variant="primary"
            size="lg"
            fullWidth
            onPress={onClose}
          />
        )
      }
    >
      <View style={styles.statusBox}>
        <Ionicons
          name={
            current.status === "approved"
              ? "checkmark-circle"
              : current.is_open
                ? "time-outline"
                : "close-circle"
          }
          size={28}
          color={
            current.status === "approved"
              ? colors.successDark
              : current.is_open
                ? colors.warning
                : colors.danger
          }
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.statusTitle}>{statusText}</Text>
          <Text style={styles.statusSub}>
            {current.is_open && left !== null
              ? t.terminals.timeLeft.replace("{s}", String(left))
              : current.card_mask
                ? `${current.card_mask}${current.receipt_number ? ` · ${t.cash.receipt} ${current.receipt_number}` : ""}`
                : current.error || ""}
          </Text>
        </View>
      </View>

      {manual && current.is_open ? (
        <View style={styles.block}>
          <Text style={styles.hint}>{t.terminals.manualHint}</Text>
          <TextInput
            value={cardMask}
            onChangeText={setCardMask}
            placeholder={t.terminals.lastDigits}
            placeholderTextColor={colors.slate400}
            keyboardType="number-pad"
            maxLength={4}
            style={styles.input}
            testID="terminal-card-mask"
          />
        </View>
      ) : null}

      {link && current.is_open && current.pay_url ? (
        <View style={styles.block}>
          <Text style={styles.hint}>{t.terminals.scanHint}</Text>
          <View style={styles.qrWrap} testID="terminal-qr">
            <QRCode value={current.pay_url} size={190} />
          </View>
          <View style={styles.row}>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+995 5xx xxx xxx"
              placeholderTextColor={colors.slate400}
              keyboardType="phone-pad"
              style={[styles.input, { flex: 1 }]}
            />
            <Pressable
              onPress={() => send.mutate()}
              disabled={!phone.trim() || send.isPending}
              style={styles.sendBtn}
            >
              <Ionicons name="send" size={18} color={colors.white} />
            </Pressable>
          </View>
          {current.sent_to ? (
            <Text style={styles.hint}>
              {t.terminals.linkSent.replace("{to}", current.sent_to)}
            </Text>
          ) : null}
        </View>
      ) : null}

      {current.provider === "ecr_bridge" && current.is_open ? (
        <Text style={styles.hint}>{t.terminals.bridgeHint}</Text>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.slate50,
    borderRadius: radius.md,
  },
  statusTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  statusSub: { fontSize: 13, color: colors.muted },
  block: { gap: spacing.sm, marginTop: spacing.md },
  hint: { fontSize: 13, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: typography.sizes.lg,
    color: colors.foreground,
    backgroundColor: colors.surface,
  },
  qrWrap: {
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
  },
  row: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: 12,
  },
  error: { color: colors.danger, fontSize: 13 },
});
