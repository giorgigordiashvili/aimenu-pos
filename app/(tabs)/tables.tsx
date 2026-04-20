import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { AxiosError } from 'axios';

import {
  closeTableSession,
  listActiveTableSessions,
  type TableSessionRow,
} from '@/api/sessions';
import Button from '@/components/Button';
import TopBar from '@/components/TopBar';
import { useT } from '@/i18n';
import { colors, radius, shadows, spacing, typography } from '@/theme/tokens';

export default function TablesScreen() {
  const t = useT();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();

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
                  isClosing={
                    closeMutation.isPending && closeMutation.variables?.id === session.id
                  }
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

interface CardProps {
  row: TableSessionRow;
  t: ReturnType<typeof useT>;
  onClose: () => void;
  isClosing: boolean;
}

function SessionCard({ row, t, onClose, isClosing }: CardProps) {
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
          <Text style={styles.unpaidText}>
            {t.tablesScreen.unpaidBadge}: {summary.unpaid_count} · {summary.unpaid_total} ₾
          </Text>
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

      <Button
        title={closeLabel}
        variant={canClose ? 'danger' : hasUnpaid ? 'outline' : 'outline'}
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
    flex: 1,
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
});
