import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import QRCode from "react-native-qrcode-svg";

import { AxiosError } from "axios";

import { getOrder } from "@/api/orders";
import type { RecordPaymentResult } from "@/api/payments";
import { can } from "@/api/restaurants";
import {
  closeTableSession,
  listActiveTableSessions,
  markTableSessionCashPaid,
  type TableSessionRow,
} from "@/api/sessions";
import {
  createTable,
  listFloorTables,
  listSections,
  saveLayout,
  startSession,
  type FloorTable,
} from "@/api/tables";
import BillModal from "@/components/BillModal";
import Button from "@/components/Button";
import FloorPlan, {
  initialDrafts,
  toLayoutItems,
  type Drafts,
} from "@/components/FloorPlan";
import PaymentSheet, { type PaymentTarget } from "@/components/PaymentSheet";
import ShiftBanner from "@/components/ShiftBanner";
import TableSheet from "@/components/TableSheet";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/i18n";
import { money } from "@/lib/money";
import { printReceiptAnywhere } from "@/lib/receipt";
import { useNow } from "@/lib/useNow";
import { usePrinters } from "@/lib/usePrinters";
import { useShift } from "@/lib/useShift";
import { colors, radius, shadows, spacing, typography } from "@/theme/tokens";

// Customer-site root — used to build the QR / deep link for self-serve
// payment. Override at build time with EXPO_PUBLIC_CUSTOMER_URL if the
// POS ever targets a different environment.
const CUSTOMER_SITE =
  (process.env.EXPO_PUBLIC_CUSTOMER_URL as string | undefined) ??
  "https://aimenu.ge";

type ViewMode = "floor" | "sessions";

export default function TablesScreen() {
  const t = useT();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const { restaurantSlug, currentRestaurant } = useAuth();
  const { canPay } = useShift();
  const { receiptPrinters } = usePrinters();
  const now = useNow(30_000);
  const canEditLayout = can(currentRestaurant, "tables", "create");
  const [view, setView] = useState<ViewMode>("floor");
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [dirty, setDirty] = useState(false);
  const [payQrSession, setPayQrSession] = useState<TableSessionRow | null>(
    null,
  );
  const [billSession, setBillSession] = useState<TableSessionRow | null>(null);
  const [payTarget, setPayTarget] = useState<PaymentTarget | null>(null);
  const [sheetTable, setSheetTable] = useState<FloorTable | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["active-sessions"],
    queryFn: () => listActiveTableSessions(),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
  const sections = useQuery({
    queryKey: ["sections"],
    queryFn: listSections,
    staleTime: 60_000,
  });
  const tables = useQuery({
    queryKey: ["floor-tables"],
    queryFn: listFloorTables,
    refetchInterval: editing ? false : 15_000,
    refetchIntervalInBackground: false,
  });

  // Drafts follow the server until the manager starts editing.
  useEffect(() => {
    if (!editing && tables.data) {
      setDrafts(initialDrafts(tables.data));
      setDirty(false);
    }
  }, [tables.data, editing]);

  const rows = data?.results ?? [];
  const sessionsByTable = useMemo(() => {
    const out: Record<string, TableSessionRow> = {};
    for (const s of rows) out[s.table] = s;
    return out;
  }, [rows]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["active-sessions"] });
    qc.invalidateQueries({ queryKey: ["floor-tables"] });
    qc.invalidateQueries({ queryKey: ["orders-board"] });
    qc.invalidateQueries({ queryKey: ["session-bill"] });
    qc.invalidateQueries({ queryKey: ["cash-shift"] });
  };

  const closeMutation = useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      closeTableSession(id, force),
    onSuccess: () => {
      invalidate();
      setSheetTable(null);
    },
  });

  // Fallback for restaurants without the Cash module: one tap records the
  // whole table as paid in cash (no shift needed while the module is off).
  const cashMutation = useMutation({
    mutationFn: (id: string) => markTableSessionCashPaid(id),
    onSuccess: invalidate,
  });

  const startMutation = useMutation({
    mutationFn: ({ table, guests }: { table: FloorTable; guests: number }) =>
      startSession(table.id, guests),
    onSuccess: () => {
      invalidate();
      setSheetTable(null);
    },
    onError: (err) => {
      const msg = (err as AxiosError<{ error?: { message?: string } }>).response
        ?.data?.error?.message;
      setNotice(msg ?? t.cash.errors.generic);
    },
  });

  const layoutMutation = useMutation({
    mutationFn: () =>
      saveLayout(
        toLayoutItems(
          drafts,
          (tables.data ?? []).map((x) => x.id),
        ),
      ),
    onSuccess: () => {
      setDirty(false);
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["floor-tables"] });
    },
    onError: () => setNotice(t.cash.errors.generic),
  });

  function confirmCashPaid(session: TableSessionRow) {
    const summary = session.orders_summary;
    const title = t.tablesScreen.cashConfirmTitle;
    const body = t.tablesScreen.cashConfirmBody
      .replace("{count}", String(summary.unpaid_count))
      .replace("{total}", summary.unpaid_total);
    const run = () => cashMutation.mutate(session.id);
    if (Platform.OS === "web") {
      if (
        typeof globalThis.confirm === "function" &&
        globalThis.confirm(`${title}\n\n${body}`)
      ) {
        run();
      }
      return;
    }
    Alert.alert(title, body, [
      { text: t.tablesScreen.closeCancel, style: "cancel" },
      {
        text: t.tablesScreen.cashConfirmAction,
        style: "default",
        onPress: run,
      },
    ]);
  }

  function promptUnpaid(
    session: TableSessionRow,
    unpaidCount: number,
    unpaidTotal: string,
  ) {
    const title = t.tablesScreen.unpaidWarningTitle;
    const body = t.tablesScreen.unpaidWarningBody
      .replace("{count}", String(unpaidCount))
      .replace("{total}", unpaidTotal);
    const run = () => closeMutation.mutate({ id: session.id, force: true });
    if (Platform.OS === "web") {
      if (
        typeof globalThis.confirm === "function" &&
        globalThis.confirm(`${title}\n\n${body}`)
      ) {
        run();
      }
      return;
    }
    Alert.alert(title, body, [
      { text: t.tablesScreen.closeCancel, style: "cancel" },
      {
        text: t.tablesScreen.unpaidForceAction,
        style: "destructive",
        onPress: run,
      },
    ]);
  }

  function confirmClose(session: TableSessionRow) {
    const summary = session.orders_summary;
    if (summary.unpaid_count > 0) {
      promptUnpaid(session, summary.unpaid_count, summary.unpaid_total);
      return;
    }
    const title = t.tablesScreen.closeConfirm;
    const body = t.tablesScreen.closeConfirmBody;
    const run = () => {
      closeMutation.mutate(
        { id: session.id },
        {
          onError: (err) => {
            const data = (
              err as AxiosError<{
                error?: {
                  code?: string;
                  unpaid_order_numbers?: string[];
                  unpaid_total?: string;
                };
              }>
            ).response?.data?.error;
            if (data?.code === "unpaid_orders") {
              promptUnpaid(
                session,
                data.unpaid_order_numbers?.length ?? 0,
                data.unpaid_total ?? "0",
              );
            }
          },
        },
      );
    };
    if (Platform.OS === "web") {
      if (
        typeof globalThis.confirm === "function" &&
        !globalThis.confirm(`${title}\n\n${body}`)
      ) {
        return;
      }
      run();
      return;
    }
    Alert.alert(title, body, [
      { text: t.tablesScreen.closeCancel, style: "cancel" },
      { text: t.tablesScreen.closeAction, style: "destructive", onPress: run },
    ]);
  }

  function payTable(session: TableSessionRow, balance?: string) {
    setSheetTable(null);
    setPayTarget({
      kind: "session",
      sessionId: session.id,
      label: `${t.tablesScreen.tableLabel} ${session.table_number}`,
      balance:
        balance ??
        session.orders_summary.balance ??
        session.orders_summary.unpaid_total,
    });
  }

  async function printLast(result: RecordPaymentResult) {
    const orderId = result.payment.order;
    if (!orderId) return;
    try {
      const order = await getOrder(orderId);
      await printReceiptAnywhere({
        order,
        payment: result.payment,
        receiptPrinters,
        restaurantSlug,
        restaurantName: currentRestaurant?.name ?? null,
      });
    } catch {
      /* printing must never block the till */
    }
  }

  const columns = width >= 1280 ? 3 : width >= 900 ? 2 : 1;
  const cardWidth =
    columns === 1 ? "100%" : (`${100 / columns - 1}%` as unknown as number);
  const hasFloor =
    (sections.data?.length ?? 0) > 0 || (tables.data?.length ?? 0) > 0;

  return (
    <SafeAreaView style={styles.root}>
      <TopBar title={t.tablesScreen.title} subtitle={t.tablesScreen.subtitle} />
      <ShiftBanner />
      <View style={styles.toolbar}>
        <View style={styles.segment}>
          {(["floor", "sessions"] as ViewMode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setView(m)}
              style={[styles.segmentBtn, view === m && styles.segmentBtnActive]}
              testID={`view-${m}`}
            >
              <Ionicons
                name={m === "floor" ? "grid-outline" : "list-outline"}
                size={16}
                color={view === m ? colors.white : colors.foreground}
              />
              <Text
                style={[
                  styles.segmentText,
                  view === m && styles.segmentTextActive,
                ]}
              >
                {m === "floor" ? t.floor.floorView : t.floor.sessionsView}
              </Text>
            </Pressable>
          ))}
        </View>
        {view === "floor" && canEditLayout ? (
          editing ? (
            <View style={styles.editActions}>
              {dirty ? (
                <Text style={styles.unsaved}>{t.floor.unsaved}</Text>
              ) : null}
              <Button
                title={t.floor.discard}
                variant="outline"
                size="sm"
                onPress={() => {
                  setEditing(false);
                  if (tables.data) setDrafts(initialDrafts(tables.data));
                  setDirty(false);
                }}
              />
              <Button
                title={t.floor.save}
                variant="primary"
                size="sm"
                loading={layoutMutation.isPending}
                disabled={!dirty || layoutMutation.isPending}
                onPress={() => layoutMutation.mutate()}
                testID="save-layout"
              />
            </View>
          ) : (
            <Button
              title={t.floor.editLayout}
              variant="outline"
              size="sm"
              onPress={() => setEditing(true)}
              testID="edit-layout"
            />
          )
        ) : null}
      </View>
      {notice ? (
        <Pressable onPress={() => setNotice(null)} style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
        </Pressable>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetch();
              tables.refetch();
            }}
          />
        }
      >
        {view === "floor" ? (
          tables.isLoading || sections.isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : !hasFloor ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t.floor.noSections}</Text>
            </View>
          ) : (
            <FloorPlan
              sections={sections.data ?? []}
              tables={tables.data ?? []}
              sessionsByTable={sessionsByTable}
              editing={editing}
              drafts={drafts}
              onDraftsChange={(next) => {
                setDrafts(next);
                setDirty(true);
              }}
              onPressTable={(table) => setSheetTable(table)}
              onAddTable={
                canEditLayout
                  ? async (body) => {
                      await createTable({
                        ...body,
                        position_x: 40,
                        position_y: 40,
                      });
                      await tables.refetch();
                    }
                  : undefined
              }
              now={now}
            />
          )
        ) : isLoading && !data ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t.tablesScreen.empty}</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {rows.map((session) => (
              <View
                key={session.id}
                style={[styles.gridItem, { width: cardWidth as any }]}
              >
                <SessionCard
                  row={session}
                  t={t}
                  canPay={canPay}
                  onClose={() => confirmClose(session)}
                  onShowPayQr={() => setPayQrSession(session)}
                  onShowBill={() => setBillSession(session)}
                  onPay={() =>
                    canPay ? payTable(session) : confirmCashPaid(session)
                  }
                  isClosing={
                    closeMutation.isPending &&
                    closeMutation.variables?.id === session.id
                  }
                  isMarkingCash={
                    cashMutation.isPending &&
                    cashMutation.variables === session.id
                  }
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <TableSheet
        table={sheetTable}
        session={sheetTable ? (sessionsByTable[sheetTable.id] ?? null) : null}
        canPay={canPay}
        busy={startMutation.isPending || closeMutation.isPending}
        onClose={() => setSheetTable(null)}
        onStartSession={(table, guests) =>
          startMutation.mutate({ table, guests })
        }
        onBill={(session) => {
          setSheetTable(null);
          setBillSession(session);
        }}
        onPay={(session) =>
          canPay ? payTable(session) : confirmCashPaid(session)
        }
        onPayQr={(session) => {
          setSheetTable(null);
          setPayQrSession(session);
        }}
        onCloseSession={(session) => confirmClose(session)}
      />

      <PayQrModal
        session={payQrSession}
        t={t}
        onClose={() => setPayQrSession(null)}
      />

      <BillModal
        sessionId={billSession?.id ?? null}
        tableNumber={billSession?.table_number}
        canPay={canPay}
        onClose={() => setBillSession(null)}
        onPayAll={(balance) => billSession && payTable(billSession, balance)}
        onPayOrder={(orderId, orderNumber, balance) =>
          setPayTarget({ kind: "order", orderId, label: orderNumber, balance })
        }
      />

      <PaymentSheet
        visible={!!payTarget}
        target={payTarget}
        onClose={() => {
          setPayTarget(null);
          invalidate();
        }}
        onPaid={() => invalidate()}
        onPrint={printLast}
      />
    </SafeAreaView>
  );
}

// ── Pay-QR modal ──────────────────────────────────────────────────────────────

interface PayQrModalProps {
  session: TableSessionRow | null;
  t: ReturnType<typeof useT>;
  onClose: () => void;
}

function PayQrModal({ session, t, onClose }: PayQrModalProps) {
  if (!session) return null;
  const url = `${CUSTOMER_SITE}/table/settle?session=${session.id}`;
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.qrOverlay} onPress={onClose}>
        <Pressable style={styles.qrPanel} onPress={() => undefined}>
          <Text style={styles.qrTitle}>{t.tablesScreen.payQrTitle}</Text>
          <Text style={styles.qrSubtitle}>
            {t.tablesScreen.payQrSubtitle
              .replace("{table}", session.table_number)
              .replace("{total}", session.orders_summary.unpaid_total)}
          </Text>
          <View style={styles.qrWrap}>
            <QRCode value={url} size={240} />
          </View>
          <Text style={styles.qrUrl} selectable>
            {url}
          </Text>
          <Button
            title={t.tablesScreen.payQrDone}
            variant="primary"
            fullWidth
            onPress={onClose}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface CardProps {
  row: TableSessionRow;
  t: ReturnType<typeof useT>;
  canPay: boolean;
  onClose: () => void;
  onShowPayQr: () => void;
  onShowBill: () => void;
  onPay: () => void;
  isClosing: boolean;
  isMarkingCash: boolean;
}

function SessionCard({
  row,
  t,
  canPay,
  onClose,
  onShowPayQr,
  onShowBill,
  onPay,
  isClosing,
  isMarkingCash,
}: CardProps) {
  const summary = row.orders_summary;
  const hasUnpaid = (summary.unpaid_count ?? 0) > 0;
  const canClose = summary.all_terminal && !hasUnpaid;
  const closeLabel = hasUnpaid
    ? t.tablesScreen.unpaidBlocked
    : canClose
      ? t.tablesScreen.closeButton
      : t.tablesScreen.closeDisabled;
  const modeLabel =
    row.payment_mode === "host_covers"
      ? t.tablesScreen.hostCovers
      : t.tablesScreen.splitBill;
  const balance = summary.balance ?? summary.unpaid_total;

  return (
    <View style={styles.card} testID={`session-${row.table_number}`}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tableLabel}>
            {t.tablesScreen.tableLabel} · {row.table_number}
          </Text>
          <Text style={styles.modeLabel}>{modeLabel}</Text>
        </View>
        <View style={styles.totalBlock}>
          <Text style={styles.totalLabel}>{t.tablesScreen.totalLabel}</Text>
          <Text style={styles.totalValue}>{summary.grand_total} ₾</Text>
          {summary.paid_total && parseFloat(summary.paid_total) > 0 ? (
            <Text style={styles.paidLabel}>
              {t.cash.paid} {money(summary.paid_total)}
            </Text>
          ) : null}
        </View>
      </View>

      {hasUnpaid ? (
        <View style={styles.unpaidBanner}>
          <Ionicons name="warning" size={16} color={colors.danger} />
          <View style={{ flex: 1 }}>
            <Text style={styles.unpaidText}>
              {t.tablesScreen.unpaidBadge}: {summary.unpaid_count} · {balance} ₾
            </Text>
            {summary.unpaid_order_numbers.length > 0 ? (
              <Text style={styles.unpaidOrders}>
                {summary.unpaid_order_numbers.join(", ")}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <Stat label={t.tablesScreen.guestsLabel} value={row.guest_count} />
        <Stat label={t.tablesScreen.ordersLabel} value={summary.total_orders} />
      </View>

      <View style={styles.statusRow}>
        <StatusChip
          n={summary.counts.pending}
          color={colors.warning}
          label="pend"
        />
        <StatusChip
          n={summary.counts.confirmed}
          color={colors.info}
          label="conf"
        />
        <StatusChip
          n={summary.counts.preparing}
          color={colors.accent}
          label="prep"
        />
        <StatusChip
          n={summary.counts.ready}
          color={colors.success}
          label="ready"
        />
        <StatusChip
          n={summary.counts.served}
          color={colors.slate500}
          label="srvd"
        />
        <StatusChip
          n={summary.counts.completed}
          color={colors.successDark}
          label="done"
        />
      </View>

      <View style={styles.buttonRow}>
        <View style={{ flex: 1 }}>
          <Button
            title={t.cash.bill}
            variant="outline"
            fullWidth
            onPress={onShowBill}
          />
        </View>
        {hasUnpaid ? (
          <View style={{ flex: 1 }}>
            <Button
              title={
                canPay
                  ? `${t.cash.pay} ${money(balance)}`
                  : t.tablesScreen.markCashButton
              }
              variant="success"
              fullWidth
              loading={isMarkingCash}
              disabled={isMarkingCash}
              onPress={onPay}
              testID="pay-table"
            />
          </View>
        ) : null}
      </View>

      {hasUnpaid ? (
        <Button
          title={t.tablesScreen.payQrButton}
          variant="primary"
          fullWidth
          onPress={onShowPayQr}
        />
      ) : null}

      <Button
        title={closeLabel}
        variant={canClose ? "danger" : "outline"}
        fullWidth
        disabled={(!canClose && !hasUnpaid) || isClosing}
        loading={isClosing}
        onPress={onClose}
      />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function StatusChip({
  n,
  color,
  label,
}: {
  n: number;
  color: string;
  label: string;
}) {
  if (!n) return null;
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: color + "22", borderColor: color },
      ]}
    >
      <Ionicons name="ellipse" size={8} color={color} />
      <Text style={[styles.chipText, { color }]}>
        {n} {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  segment: {
    flexDirection: "row",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  segmentBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  segmentBtnActive: { backgroundColor: colors.slate900 },
  segmentText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  segmentTextActive: { color: colors.white },
  editActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  unsaved: {
    fontSize: typography.sizes.xs,
    color: colors.warningDark,
    fontWeight: typography.weights.semibold,
  },
  notice: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: colors.dangerTint,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noticeText: { color: colors.danger, fontWeight: typography.weights.semibold },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  loading: { paddingVertical: spacing.xxxl, alignItems: "center" },
  empty: { paddingVertical: spacing.xxxl, alignItems: "center" },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.muted,
    textAlign: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  gridItem: { minWidth: 280 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.md,
    ...shadows.sm,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  tableLabel: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  modeLabel: {
    fontSize: typography.sizes.xs,
    color: colors.muted,
    marginTop: 2,
  },
  totalBlock: { alignItems: "flex-end" },
  totalLabel: { fontSize: typography.sizes.xs, color: colors.muted },
  totalValue: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  paidLabel: {
    fontSize: typography.sizes.xs,
    color: colors.successDark,
    fontWeight: typography.weights.semibold,
  },
  statsRow: { flexDirection: "row", gap: spacing.md },
  stat: { flex: 1 },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
    marginTop: 2,
  },
  unpaidBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.danger + "1A",
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  unpaidText: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
    fontWeight: typography.weights.semibold,
  },
  unpaidOrders: {
    fontSize: typography.sizes.xs,
    color: colors.danger,
    marginTop: 2,
    opacity: 0.9,
  },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  buttonRow: { flexDirection: "row", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  qrOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 43, 0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  qrPanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    maxWidth: 360,
    width: "100%",
    gap: spacing.md,
    alignItems: "center",
  },
  qrTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
    textAlign: "center",
  },
  qrSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  qrWrap: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  qrUrl: {
    fontSize: typography.sizes.xs,
    color: colors.muted,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
