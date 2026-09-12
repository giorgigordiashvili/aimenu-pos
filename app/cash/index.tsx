import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { listShifts, type CashShift } from "@/api/payments";
import Button from "@/components/Button";
import {
  CloseShiftDialog,
  MovementDialog,
  OpenShiftDialog,
} from "@/components/ShiftBanner";
import { useT } from "@/i18n";
import { money, num } from "@/lib/money";
import { useShift } from "@/lib/useShift";
import { colors, radius, shadows, spacing, typography } from "@/theme/tokens";

function when(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Shift history + quick open / close / paid in-out. */
export default function CashScreen() {
  const t = useT();
  const router = useRouter();
  const { shift, canOpen, canClose } = useShift();
  const [dialog, setDialog] = useState<"open" | "close" | "movement" | null>(
    null,
  );
  const shifts = useQuery({
    queryKey: ["shifts"],
    queryFn: () => listShifts(),
  });
  const rows = shifts.data?.results ?? [];

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← {t.reservationDetails.back}</Text>
        </Pressable>
        <Text style={styles.title}>{t.cash.title}</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={shifts.isRefetching}
            onRefresh={() => shifts.refetch()}
          />
        }
      >
        <View style={styles.card} testID="current-shift">
          <Text style={styles.cardTitle}>{t.cash.shift}</Text>
          <Text style={styles.big}>
            {shift
              ? t.cash.shiftOpen.replace("{n}", String(shift.number))
              : t.cash.noShift}
          </Text>
          {shift ? (
            <Text style={styles.muted}>
              {t.cash.opened} {when(shift.opened_at)} · {shift.opened_by_name} ·{" "}
              {t.cash.openingFloat} {money(shift.opening_float)}
            </Text>
          ) : null}
          <View style={styles.actions}>
            {shift ? (
              <>
                <Button
                  title={t.cash.xReport}
                  variant="outline"
                  onPress={() => router.push(`/cash/shift/${shift.id}` as Href)}
                />
                {canOpen ? (
                  <Button
                    title={t.cash.paidInOut}
                    variant="outline"
                    onPress={() => setDialog("movement")}
                  />
                ) : null}
                {canClose ? (
                  <Button
                    title={t.cash.closeShift}
                    variant="danger"
                    onPress={() => setDialog("close")}
                  />
                ) : null}
              </>
            ) : canOpen ? (
              <Button
                title={t.cash.openShift}
                variant="primary"
                onPress={() => setDialog("open")}
              />
            ) : null}
          </View>
        </View>

        <Text style={styles.section}>{t.cash.history}</Text>
        {shifts.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : rows.length === 0 ? (
          <Text style={styles.muted}>{t.cash.noShifts}</Text>
        ) : (
          rows.map((s) => (
            <ShiftRow
              key={s.id}
              shift={s}
              onPress={() => router.push(`/cash/shift/${s.id}` as Href)}
            />
          ))
        )}
      </ScrollView>
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
    </SafeAreaView>
  );
}

function ShiftRow({
  shift,
  onPress,
}: {
  shift: CashShift;
  onPress: () => void;
}) {
  const t = useT();
  const diff = shift.difference === null ? null : num(shift.difference);
  const diffColor =
    diff === null
      ? colors.muted
      : diff === 0
        ? colors.successDark
        : diff < 0
          ? colors.danger
          : colors.warning;
  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button">
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>
          {t.cash.shiftOpen.replace("{n}", String(shift.number))} ·{" "}
          {shift.status === "open" ? t.cash.opened : t.cash.closed}
        </Text>
        <Text style={styles.muted}>
          {when(shift.opened_at)} →{" "}
          {shift.closed_at ? when(shift.closed_at) : "…"} ·{" "}
          {shift.opened_by_name}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.rowValue}>
          {shift.status === "closed"
            ? money(shift.report?.net_sales ?? "0")
            : money(shift.opening_float)}
        </Text>
        {diff !== null ? (
          <Text style={[styles.diff, { color: diffColor }]}>
            {diff > 0 ? "+" : ""}
            {diff.toFixed(2)} ₾
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.slate400} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  back: { paddingVertical: spacing.sm, width: 60 },
  backText: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.md,
    maxWidth: 800,
    width: "100%",
    alignSelf: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...shadows.sm,
  },
  cardTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  big: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  muted: { fontSize: typography.sizes.sm, color: colors.muted },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  section: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
    marginTop: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  rowTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  rowValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  diff: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
});
