import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { TableSessionRow } from "@/api/sessions";
import type { FloorTable } from "@/api/tables";
import Button from "@/components/Button";
import Sheet from "@/components/Sheet";
import { useT } from "@/i18n";
import { money } from "@/lib/money";
import { colors, radius, spacing, typography } from "@/theme/tokens";

interface Props {
  table: FloorTable | null;
  session: TableSessionRow | null;
  canPay: boolean;
  busy?: boolean;
  onClose: () => void;
  onStartSession: (table: FloorTable, guests: number) => void;
  onBill: (session: TableSessionRow) => void;
  onPay: (session: TableSessionRow) => void;
  onPayQr: (session: TableSessionRow) => void;
  onCloseSession: (session: TableSessionRow) => void;
}

/** Tap a table on the floor: seat guests, or the running session's bill / pay / close. */
export default function TableSheet({
  table,
  session,
  canPay,
  busy,
  onClose,
  onStartSession,
  onBill,
  onPay,
  onPayQr,
  onCloseSession,
}: Props) {
  const t = useT();
  const [guests, setGuests] = useState(2);
  useEffect(() => {
    if (table) setGuests(Math.min(Math.max(table.capacity || 2, 1), 12));
  }, [table]);
  if (!table) return null;
  const summary = session?.orders_summary;
  const balance = summary?.balance ?? summary?.unpaid_total ?? "0";
  const hasUnpaid = (summary?.unpaid_count ?? 0) > 0;

  return (
    <Sheet
      visible={!!table}
      title={`${t.tablesScreen.tableLabel} ${table.number}${table.name ? ` · ${table.name}` : ""}`}
      subtitle={`${table.capacity} ${t.floor.seats.toLowerCase()} · ${(t.floor.status as Record<string, string>)[session ? "occupied" : table.status] ?? table.status}`}
      onClose={onClose}
      maxWidth={480}
      testID="table-sheet"
    >
      {session ? (
        <>
          <View style={styles.stats}>
            <Stat
              label={t.tablesScreen.guestsLabel}
              value={String(session.guest_count)}
            />
            <Stat
              label={t.tablesScreen.ordersLabel}
              value={String(summary?.total_orders ?? 0)}
            />
            <Stat
              label={t.tablesScreen.totalLabel}
              value={money(summary?.grand_total)}
            />
            <Stat
              label={t.cash.balance}
              value={money(balance)}
              tone={hasUnpaid ? "danger" : "ok"}
            />
          </View>
          <Button
            title={t.cash.bill}
            variant="outline"
            size="lg"
            fullWidth
            onPress={() => onBill(session)}
          />
          {hasUnpaid && canPay ? (
            <Button
              title={`${t.cash.pay} ${money(balance)}`}
              variant="success"
              size="lg"
              fullWidth
              onPress={() => onPay(session)}
            />
          ) : null}
          {hasUnpaid ? (
            <Button
              title={t.tablesScreen.payQrButton}
              variant="primary"
              size="lg"
              fullWidth
              onPress={() => onPayQr(session)}
            />
          ) : null}
          <Button
            title={
              hasUnpaid
                ? t.tablesScreen.unpaidBlocked
                : t.tablesScreen.closeButton
            }
            variant={hasUnpaid ? "outline" : "danger"}
            size="lg"
            fullWidth
            loading={busy}
            onPress={() => onCloseSession(session)}
          />
        </>
      ) : (
        <>
          <Text style={styles.fieldLabel}>{t.floor.guests}</Text>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => setGuests((g) => Math.max(1, g - 1))}
              style={styles.stepBtn}
            >
              <Ionicons name="remove" size={22} color={colors.foreground} />
            </Pressable>
            <Text style={styles.stepValue}>{guests}</Text>
            <Pressable
              onPress={() => setGuests((g) => Math.min(40, g + 1))}
              style={styles.stepBtn}
            >
              <Ionicons name="add" size={22} color={colors.foreground} />
            </Pressable>
          </View>
          <Button
            title={t.floor.startSession}
            variant="primary"
            size="lg"
            fullWidth
            loading={busy}
            disabled={busy || table.status === "unavailable"}
            onPress={() => onStartSession(table, guests)}
            testID="start-session"
          />
        </>
      )}
    </Sheet>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "ok";
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={[
          styles.statValue,
          tone === "danger" && { color: colors.danger },
          tone === "ok" && { color: colors.successDark },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  stat: {
    minWidth: 100,
    flexGrow: 1,
    backgroundColor: colors.slate50,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
  },
  stepBtn: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: {
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
});
