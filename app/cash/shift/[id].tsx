import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { getShift, getXReport, type ShiftReport } from "@/api/payments";
import Button from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/i18n";
import { money } from "@/lib/money";
import { printShiftReport } from "@/api/printing";
import { buildZReportHtml, printHtml } from "@/lib/printReceipt";
import { usePrinters } from "@/lib/usePrinters";
import { colors, radius, shadows, spacing, typography } from "@/theme/tokens";

/** One shift: the frozen Z report, or the live X report while it is open. */
export default function ShiftDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const { currentRestaurant } = useAuth();
  const { receiptPrinters } = usePrinters();
  const shift = useQuery({
    queryKey: ["shift", id],
    queryFn: () => getShift(id!),
    enabled: !!id,
  });
  const isOpen = shift.data?.status === "open";
  const live = useQuery({
    queryKey: ["x-report"],
    queryFn: getXReport,
    enabled: isOpen,
    refetchInterval: 15_000,
  });
  const report: Partial<ShiftReport> | undefined = isOpen
    ? live.data?.report
    : shift.data?.report;

  if (!shift.data || !report) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }
  const s = shift.data;
  const methods = t.cash.methods as Record<string, string>;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← {t.reservationDetails.back}</Text>
        </Pressable>
        <Text style={styles.title}>
          {isOpen ? t.cash.xReport : t.cash.zReport} ·{" "}
          {t.cash.shiftOpen.replace("{n}", String(s.number))}
        </Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card} testID="shift-report">
          <Row label={t.cash.sales} value={money(report.sales)} />
          <Row label={t.cash.tips} value={money(report.tips)} />
          <Row label={t.cash.refunds} value={`−${money(report.refunds)}`} />
          <Row label={t.cash.netSales} value={money(report.net_sales)} strong />
          <Row
            label={t.cash.payments}
            value={String(report.payments_count ?? 0)}
          />
          <Row label={t.cash.orders} value={String(report.orders_count ?? 0)} />
        </View>

        <Section title={t.cash.byMethod}>
          {Object.entries(report.by_method ?? {}).map(([m, v]) => (
            <Row
              key={m}
              label={`${methods[m] ?? m} (${v.count})`}
              value={`${money(v.amount)} + ${money(v.tips)}`}
            />
          ))}
          {Object.keys(report.by_method ?? {}).length === 0 ? (
            <Text style={styles.muted}>—</Text>
          ) : null}
        </Section>

        <Section title={t.cash.drawer}>
          <Row
            label={t.cash.openingFloat}
            value={money(report.opening_float)}
          />
          <Row
            label={`${t.cash.sales} (${t.cash.methods.cash})`}
            value={money(report.cash_sales)}
          />
          <Row
            label={`${t.cash.tips} (${t.cash.methods.cash})`}
            value={money(report.cash_tips)}
          />
          <Row label={t.cash.paidIn} value={money(report.paid_in)} />
          <Row label={t.cash.paidOut} value={`−${money(report.paid_out)}`} />
          <Row
            label={t.cash.refunds}
            value={`−${money(report.cash_refunds)}`}
          />
          <Row
            label={t.cash.expectedCash}
            value={money(report.expected_cash)}
            strong
          />
          {!isOpen ? (
            <>
              <Row
                label={t.cash.countedCash}
                value={money(report.counted_cash)}
              />
              <Row
                label={t.cash.difference}
                value={money(report.difference)}
                strong
              />
            </>
          ) : null}
          {(report.movements ?? []).map((m, i) => (
            <Row
              key={i}
              label={`${m.kind === "paid_in" ? t.cash.paidIn : t.cash.paidOut}: ${m.reason} (${m.by})`}
              value={money(m.amount)}
              muted
            />
          ))}
        </Section>

        <Section title={`${t.cash.discounts} · ${t.cash.voids}`}>
          <Row
            label={`${t.cash.discounts} (${report.discounts?.orders_count ?? 0} + ${report.discounts?.items_count ?? 0})`}
            value={money(
              Number(report.discounts?.orders_amount ?? 0) +
                Number(report.discounts?.items_amount ?? 0),
            )}
          />
          <Row
            label={`${t.cash.comps} (${report.comps?.count ?? 0})`}
            value={money(report.comps?.amount)}
          />
          <Row
            label={`${t.cash.voids} (${report.voids?.count ?? 0}, ${t.cash.afterKitchen} ${report.voids?.after_kitchen_count ?? 0})`}
            value={money(report.voids?.amount)}
          />
        </Section>

        <Button
          title={t.cash.print}
          variant="outline"
          size="lg"
          fullWidth
          onPress={() =>
            receiptPrinters.length > 0
              ? printShiftReport(s.id)
              : printHtml(
                  buildZReportHtml(s, report, currentRestaurant?.name ?? null),
                )
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text
        style={[
          styles.rowLabel,
          strong && styles.rowLabelStrong,
          muted && { fontSize: typography.sizes.xs },
        ]}
      >
        {label}
      </Text>
      <Text style={[styles.rowValue, strong && styles.rowValueStrong]}>
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
    gap: spacing.md,
  },
  back: { paddingVertical: spacing.sm, width: 60 },
  backText: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.md,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  rowLabel: { flex: 1, fontSize: typography.sizes.sm, color: colors.muted },
  rowLabelStrong: {
    color: colors.foreground,
    fontWeight: typography.weights.bold,
  },
  rowValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  rowValueStrong: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  muted: { fontSize: typography.sizes.sm, color: colors.muted },
});
