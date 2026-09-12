import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  addMovement,
  closeShift,
  getXReport,
  ledgerErrorCode,
  ledgerErrorMessage,
  openShift,
} from "@/api/payments";
import Button from "@/components/Button";
import Sheet from "@/components/Sheet";
import { useT } from "@/i18n";
import { fixed, money, num } from "@/lib/money";
import { useShift } from "@/lib/useShift";
import { colors, radius, spacing, typography } from "@/theme/tokens";

type Dialog = "open" | "close" | "movement" | null;

/**
 * Sits under the TopBar on Tables / Orders: "No open shift · Open" or
 * "Shift #12 · drawer 340 ₾ · X report · Paid in/out · Close".
 * Renders nothing while the Cash module is off.
 */
export default function ShiftBanner() {
  const t = useT();
  const router = useRouter();
  const { enabled, shift, canOpen, canClose } = useShift();
  const [dialog, setDialog] = useState<Dialog>(null);
  if (!enabled) return null;

  return (
    <View
      style={[styles.root, shift ? styles.open : styles.closed]}
      testID="shift-banner"
    >
      <Ionicons
        name="cash-outline"
        size={18}
        color={shift ? colors.successDark : colors.warningDark}
      />
      <Text
        style={[styles.text, shift ? styles.textOpen : styles.textClosed]}
        numberOfLines={1}
      >
        {shift
          ? `${t.cash.shiftOpen.replace("{n}", String(shift.number))} · ${shift.opened_by_name || ""}`
          : `${t.cash.noShift} · ${t.cash.shiftBannerHint}`}
      </Text>
      <View style={styles.actions}>
        {shift ? (
          <>
            <Link
              label={t.cash.xReport}
              onPress={() => router.push(`/cash/shift/${shift.id}` as Href)}
            />
            {canOpen ? (
              <Link
                label={t.cash.paidInOut}
                onPress={() => setDialog("movement")}
              />
            ) : null}
            {canClose ? (
              <Link
                label={t.cash.closeShift}
                onPress={() => setDialog("close")}
                strong
              />
            ) : null}
          </>
        ) : canOpen ? (
          <Link
            label={t.cash.openShift}
            onPress={() => setDialog("open")}
            strong
          />
        ) : null}
      </View>
      <OpenShiftDialog
        visible={dialog === "open"}
        onClose={() => setDialog(null)}
      />
      <CloseShiftDialog
        visible={dialog === "close"}
        onClose={() => setDialog(null)}
      />
      <MovementDialog
        visible={dialog === "movement"}
        shiftId={shift?.id ?? null}
        onClose={() => setDialog(null)}
      />
    </View>
  );
}

function Link({
  label,
  onPress,
  strong,
}: {
  label: string;
  onPress: () => void;
  strong?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.link, strong && styles.linkStrong]}
      accessibilityRole="button"
    >
      <Text style={[styles.linkText, strong && styles.linkTextStrong]}>
        {label}
      </Text>
    </Pressable>
  );
}

function useErrorText() {
  const t = useT();
  return (err: unknown) => {
    const code = ledgerErrorCode(err);
    const known = code
      ? (t.cash.errors as Record<string, string>)[code]
      : undefined;
    return known ?? ledgerErrorMessage(err) ?? t.cash.errors.generic;
  };
}

export function OpenShiftDialog({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const errorText = useErrorText();
  const [float, setFloat] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setFloat("");
      setError(null);
    }
  }, [visible]);
  const open = useMutation({
    mutationFn: () => openShift({ opening_float: fixed(num(float)) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash-shift"] });
      qc.invalidateQueries({ queryKey: ["shifts"] });
      onClose();
    },
    onError: (err) => setError(errorText(err)),
  });
  return (
    <Sheet
      visible={visible}
      title={t.cash.openShift}
      onClose={onClose}
      maxWidth={440}
      testID="open-shift-dialog"
      footer={
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title={t.cash.openShift}
            variant="primary"
            size="lg"
            fullWidth
            loading={open.isPending}
            onPress={() => open.mutate()}
          />
        </>
      }
    >
      <Text style={styles.fieldLabel}>{t.cash.openingFloat}</Text>
      <TextInput
        value={float}
        onChangeText={setFloat}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={colors.slate400}
        style={styles.bigInput}
        autoFocus
        testID="opening-float"
      />
    </Sheet>
  );
}

export function CloseShiftDialog({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const router = useRouter();
  const errorText = useErrorText();
  const [counted, setCounted] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setCounted("");
      setError(null);
    }
  }, [visible]);
  const x = useQuery({
    queryKey: ["x-report"],
    queryFn: getXReport,
    enabled: visible,
  });
  const expected = num(x.data?.report.expected_cash);
  const diff =
    counted === "" ? null : Math.round((num(counted) - expected) * 100) / 100;
  const close = useMutation({
    mutationFn: () =>
      closeShift(x.data!.shift.id, { counted_cash: fixed(num(counted)) }),
    onSuccess: (shift) => {
      qc.invalidateQueries({ queryKey: ["cash-shift"] });
      qc.invalidateQueries({ queryKey: ["shifts"] });
      onClose();
      router.push(`/cash/shift/${shift.id}` as Href);
    },
    onError: (err) => setError(errorText(err)),
  });
  const r = x.data?.report;
  return (
    <Sheet
      visible={visible}
      title={t.cash.closeShift}
      subtitle={
        x.data
          ? t.cash.shiftOpen.replace("{n}", String(x.data.shift.number))
          : undefined
      }
      onClose={onClose}
      maxWidth={480}
      testID="close-shift-dialog"
      footer={
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title={t.cash.closeShift}
            variant="danger"
            size="lg"
            fullWidth
            disabled={!x.data || counted === "" || close.isPending}
            loading={close.isPending}
            onPress={() => close.mutate()}
          />
        </>
      }
    >
      {r ? (
        <View style={styles.summary}>
          <Row label={t.cash.openingFloat} value={money(r.opening_float)} />
          <Row
            label={`${t.cash.sales} (${t.cash.methods.cash})`}
            value={money(r.cash_sales)}
          />
          <Row label={t.cash.tips} value={money(r.cash_tips)} />
          <Row label={t.cash.paidIn} value={money(r.paid_in)} />
          <Row label={t.cash.paidOut} value={`−${money(r.paid_out)}`} />
          <Row label={t.cash.refunds} value={`−${money(r.cash_refunds)}`} />
          <Row
            label={t.cash.expectedCash}
            value={money(r.expected_cash)}
            strong
          />
        </View>
      ) : null}
      <Text style={styles.fieldLabel}>{t.cash.countedCash}</Text>
      <TextInput
        value={counted}
        onChangeText={setCounted}
        keyboardType="decimal-pad"
        placeholder={fixed(expected)}
        placeholderTextColor={colors.slate400}
        style={styles.bigInput}
        autoFocus
        testID="counted-cash"
      />
      {diff !== null ? (
        <Row
          label={t.cash.difference}
          value={`${diff > 0 ? "+" : ""}${diff.toFixed(2)} ₾`}
          strong
          tone={diff === 0 ? "ok" : diff < 0 ? "bad" : "warn"}
        />
      ) : null}
    </Sheet>
  );
}

export function MovementDialog({
  visible,
  shiftId,
  onClose,
}: {
  visible: boolean;
  shiftId: string | null;
  onClose: () => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const errorText = useErrorText();
  const [kind, setKind] = useState<"paid_in" | "paid_out">("paid_out");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setAmount("");
      setReason("");
      setError(null);
    }
  }, [visible]);
  const add = useMutation({
    mutationFn: () =>
      addMovement(shiftId!, {
        kind,
        amount: fixed(num(amount)),
        reason: reason.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash-shift"] });
      qc.invalidateQueries({ queryKey: ["x-report"] });
      onClose();
    },
    onError: (err) => setError(errorText(err)),
  });
  return (
    <Sheet
      visible={visible}
      title={t.cash.paidInOut}
      onClose={onClose}
      maxWidth={440}
      footer={
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title={kind === "paid_in" ? t.cash.paidIn : t.cash.paidOut}
            variant="primary"
            size="lg"
            fullWidth
            disabled={
              !shiftId || num(amount) <= 0 || !reason.trim() || add.isPending
            }
            loading={add.isPending}
            onPress={() => add.mutate()}
          />
        </>
      }
    >
      <View style={styles.kinds}>
        {(["paid_out", "paid_in"] as const).map((k) => (
          <Pressable
            key={k}
            onPress={() => setKind(k)}
            style={[styles.kind, kind === k && styles.kindActive]}
          >
            <Text
              style={[styles.kindText, kind === k && styles.kindTextActive]}
            >
              {k === "paid_in" ? t.cash.paidIn : t.cash.paidOut}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.fieldLabel}>{t.cash.amount}</Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={colors.slate400}
        style={styles.bigInput}
      />
      <Text style={styles.fieldLabel}>{t.cash.reason}</Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder={t.cash.reasonRequired}
        placeholderTextColor={colors.slate400}
        style={styles.input}
      />
    </Sheet>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "ok" | "warn" | "bad";
}) {
  const color =
    tone === "ok"
      ? colors.successDark
      : tone === "bad"
        ? colors.danger
        : tone === "warn"
          ? colors.warning
          : colors.foreground;
  return (
    <View style={styles.row}>
      <Text
        style={[
          styles.rowLabel,
          strong && {
            fontWeight: typography.weights.bold,
            color: colors.foreground,
          },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.rowValue,
          strong && {
            fontWeight: typography.weights.bold,
            fontSize: typography.sizes.lg,
          },
          { color },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    flexWrap: "wrap",
  },
  open: {
    backgroundColor: colors.successTint,
    borderBottomColor: colors.success,
  },
  closed: {
    backgroundColor: colors.warningTint,
    borderBottomColor: colors.warning,
  },
  text: {
    flex: 1,
    minWidth: 160,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  textOpen: { color: colors.successDark },
  textClosed: { color: colors.warningDark },
  actions: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" },
  link: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  linkStrong: {
    backgroundColor: colors.slate900,
    borderColor: colors.slate900,
  },
  linkText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  linkTextStrong: { color: colors.white },
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
    fontSize: typography.sizes.md,
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
  summary: {
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
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  kinds: { flexDirection: "row", gap: spacing.sm },
  kind: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  kindActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  kindText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  kindTextActive: { color: colors.primary },
  error: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
});
