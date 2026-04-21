import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AxiosError } from 'axios';

import {
  closeTableSession,
  listActiveTableSessions,
  markTableSessionCashPaid,
  type TableSessionRow,
} from '@/api/sessions';
import Button from '@/components/Button';
import TopBar from '@/components/TopBar';
import { useT } from '@/i18n';
import { colors, radius, shadows, spacing, typography } from '@/theme/tokens';

// Customer-site root — used to build the QR / deep link for self-serve
// payment. Override at build time with EXPO_PUBLIC_CUSTOMER_URL if the
// POS ever targets a different environment.
const CUSTOMER_SITE =
  (process.env.EXPO_PUBLIC_CUSTOMER_URL as string | undefined) ?? 'https://aimenu.ge';

export default function TablesScreen() {
  const t = useT();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  // When set, the big pay-QR overlay is visible. Staff points a customer
  // at the screen (or hands over the iPad) to let them settle with their
  // own phone. The session id is enough for /table/settle to load —
  // TableContext seeds itself from the URL param.
  const [payQrSession, setPayQrSession] = useState<TableSessionRow | null>(null);

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['active-sessions'],
    queryFn: () => listActiveTableSessions(),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });

  const closeMutation = useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      closeTableSession(id, force),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-sessions'] });
      qc.invalidateQueries({ queryKey: ['orders-board'] });
    },
  });

  const cashMutation = useMutation({
    mutationFn: (id: string) => markTableSessionCashPaid(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-sessions'] });
      qc.invalidateQueries({ queryKey: ['orders-board'] });
    },
  });

  function confirmCashPaid(session: TableSessionRow) {
    const summary = session.orders_summary;
    const title = t.tablesScreen.cashConfirmTitle;
    const body = t.tablesScreen.cashConfirmBody
      .replace('{count}', String(summary.unpaid_count))
      .replace('{total}', summary.unpaid_total);
    const run = () => cashMutation.mutate(session.id);
    if (Platform.OS === 'web') {
      if (typeof globalThis.confirm === 'function' && globalThis.confirm(`${title}\n\n${body}`)) {
        run();
      }
      return;
    }
    Alert.alert(title, body, [
      { text: t.tablesScreen.closeCancel, style: 'cancel' },
      { text: t.tablesScreen.cashConfirmAction, style: 'default', onPress: run },
    ]);
  }

  function promptUnpaid(session: TableSessionRow, unpaidCount: number, unpaidTotal: string) {
    const title = t.tablesScreen.unpaidWarningTitle;
    const body = t.tablesScreen.unpaidWarningBody
      .replace('{count}', String(unpaidCount))
      .replace('{total}', unpaidTotal);
    const run = () => closeMutation.mutate({ id: session.id, force: true });
    if (Platform.OS === 'web') {
      if (typeof globalThis.confirm === 'function' && globalThis.confirm(`${title}\n\n${body}`)) {
        run();
      }
      return;
    }
    Alert.alert(title, body, [
      { text: t.tablesScreen.closeCancel, style: 'cancel' },
      { text: t.tablesScreen.unpaidForceAction, style: 'destructive', onPress: run },
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
          onError: err => {
            const data = (err as AxiosError<{ error?: { code?: string; unpaid_order_numbers?: string[]; unpaid_total?: string } }>)
              .response?.data?.error;
            if (data?.code === 'unpaid_orders') {
              promptUnpaid(
                session,
                data.unpaid_order_numbers?.length ?? 0,
                data.unpaid_total ?? '0'
              );
            }
          },
        }
      );
    };
    if (Platform.OS === 'web') {
      if (typeof globalThis.confirm === 'function' && !globalThis.confirm(`${title}\n\n${body}`)) {
        return;
      }
      run();
      return;
    }
    Alert.alert(title, body, [
      { text: t.tablesScreen.closeCancel, style: 'cancel' },
      { text: t.tablesScreen.closeAction, style: 'destructive', onPress: run },
    ]);
  }

  const rows = data?.results ?? [];
  const columns = width >= 1280 ? 3 : width >= 900 ? 2 : 1;
  const cardWidth = columns === 1 ? '100%' : (`${100 / columns - 1}%` as unknown as number);

  return (
    <SafeAreaView style={styles.root}>
      <TopBar title={t.tablesScreen.title} subtitle={t.tablesScreen.subtitle} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      >
        {isLoading && !data ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} size='large' />
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t.tablesScreen.empty}</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {rows.map(session => (
              <View key={session.id} style={[styles.gridItem, { width: cardWidth as any }]}>
                <SessionCard
                  row={session}
                  t={t}
                  onClose={() => confirmClose(session)}
                  onShowPayQr={() => setPayQrSession(session)}
                  onMarkCash={() => confirmCashPaid(session)}
                  isClosing={
                    closeMutation.isPending && closeMutation.variables?.id === session.id
                  }
                  isMarkingCash={
                    cashMutation.isPending && cashMutation.variables === session.id
                  }
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <PayQrModal
        session={payQrSession}
        t={t}
        onClose={() => setPayQrSession(null)}
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
    <Modal
      visible
      animationType='fade'
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.qrOverlay} onPress={onClose}>
        <Pressable style={styles.qrPanel} onPress={() => undefined}>
          <Text style={styles.qrTitle}>{t.tablesScreen.payQrTitle}</Text>
          <Text style={styles.qrSubtitle}>
            {t.tablesScreen.payQrSubtitle
              .replace('{table}', session.table_number)
              .replace('{total}', session.orders_summary.unpaid_total)}
          </Text>
          <View style={styles.qrWrap}>
            <QRCode value={url} size={240} />
          </View>
          <Text style={styles.qrUrl} selectable>
            {url}
          </Text>
          <Button
            title={t.tablesScreen.payQrDone}
            variant='primary'
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
  onClose: () => void;
  onShowPayQr: () => void;
  onMarkCash: () => void;
  isClosing: boolean;
  isMarkingCash: boolean;
}

function SessionCard({
  row,
  t,
  onClose,
  onShowPayQr,
  onMarkCash,
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
    row.payment_mode === 'host_covers' ? t.tablesScreen.hostCovers : t.tablesScreen.splitBill;

  return (
    <View style={styles.card}>
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
        </View>
      </View>

      {hasUnpaid ? (
        <View style={styles.unpaidBanner}>
          <Ionicons name='warning' size={16} color={colors.danger} />
          <View style={{ flex: 1 }}>
            <Text style={styles.unpaidText}>
              {t.tablesScreen.unpaidBadge}: {summary.unpaid_count} · {summary.unpaid_total} ₾
            </Text>
            {summary.unpaid_order_numbers.length > 0 ? (
              <Text style={styles.unpaidOrders}>{summary.unpaid_order_numbers.join(', ')}</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <Stat label={t.tablesScreen.guestsLabel} value={row.guest_count} />
        <Stat label={t.tablesScreen.ordersLabel} value={summary.total_orders} />
      </View>

      <View style={styles.statusRow}>
        <StatusChip n={summary.counts.pending} color={colors.warning} label='pend' />
        <StatusChip n={summary.counts.confirmed} color={colors.info} label='conf' />
        <StatusChip n={summary.counts.preparing} color={colors.accent} label='prep' />
        <StatusChip n={summary.counts.ready} color={colors.success} label='ready' />
        <StatusChip n={summary.counts.served} color={colors.slate500} label='srvd' />
        <StatusChip n={summary.counts.completed} color={colors.successDark} label='done' />
      </View>

      {hasUnpaid ? (
        <>
          <Button
            title={t.tablesScreen.payQrButton}
            variant='primary'
            fullWidth
            onPress={onShowPayQr}
          />
          <Button
            title={t.tablesScreen.markCashButton}
            variant='success'
            fullWidth
            loading={isMarkingCash}
            disabled={isMarkingCash}
            onPress={onMarkCash}
          />
        </>
      ) : null}

      <Button
        title={closeLabel}
        variant={canClose ? 'danger' : 'outline'}
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

function StatusChip({ n, color, label }: { n: number; color: string; label: string }) {
  if (!n) return null;
  return (
    <View style={[styles.chip, { backgroundColor: color + '22', borderColor: color }]}>
      <Ionicons name='ellipse' size={8} color={color} />
      <Text style={[styles.chipText, { color }]}>
        {n} {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  loading: { paddingVertical: spacing.xxxl, alignItems: 'center' },
  empty: { paddingVertical: spacing.xxxl, alignItems: 'center' },
  emptyText: { fontSize: typography.sizes.md, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
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
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  tableLabel: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  modeLabel: { fontSize: typography.sizes.xs, color: colors.muted, marginTop: 2 },
  totalBlock: { alignItems: 'flex-end' },
  totalLabel: { fontSize: typography.sizes.xs, color: colors.muted },
  totalValue: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1 },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
    marginTop: 2,
  },
  unpaidBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.danger + '1A',
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
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
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
    backgroundColor: 'rgba(15, 23, 43, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  qrPanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    maxWidth: 360,
    width: '100%',
    gap: spacing.md,
    alignItems: 'center',
  },
  qrTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
    textAlign: 'center',
  },
  qrSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.muted,
    textAlign: 'center',
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
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
