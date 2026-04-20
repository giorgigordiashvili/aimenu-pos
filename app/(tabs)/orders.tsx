import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { listOrders, resolveOrderStatus, type OrderListRow, type OrderStatus } from '@/api/orders';
import Button from '@/components/Button';
import StatusBadge from '@/components/StatusBadge';
import TopBar from '@/components/TopBar';
import { useT } from '@/i18n';
import { colors, radius, shadows, spacing, typography } from '@/theme/tokens';

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatCurrency(raw: string | undefined | null): string {
  if (!raw) return '—';
  const n = parseFloat(raw);
  return `${n.toFixed(2)} ₾`;
}

const COLUMN_TONES: Record<OrderStatus, { bg: string; border: string; accent: string }> = {
  pending_payment: {
    bg: colors.warningTint,
    border: colors.warning,
    accent: colors.warning,
  },
  pending: {
    bg: colors.warningTint,
    border: colors.warning,
    accent: colors.warning,
  },
  confirmed: {
    bg: colors.infoTint,
    border: colors.info,
    accent: colors.info,
  },
  preparing: {
    bg: colors.accentTint,
    border: colors.accent,
    accent: colors.accent,
  },
  ready: {
    bg: colors.successTint,
    border: colors.success,
    accent: colors.success,
  },
  served: {
    bg: colors.slate100,
    border: colors.slate400,
    accent: colors.slate600,
  },
  completed: {
    bg: colors.slate100,
    border: colors.slate400,
    accent: colors.slate600,
  },
  cancelled: {
    bg: colors.dangerTint,
    border: colors.danger,
    accent: colors.danger,
  },
};

export default function OrdersScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 1024;
  const [search, setSearch] = useState('');
  const t = useT();
  const COLUMNS: { key: OrderStatus; label: string }[] = [
    { key: 'pending', label: t.ordersScreen.columns.pending },
    { key: 'confirmed', label: t.ordersScreen.columns.confirmed },
    { key: 'preparing', label: t.ordersScreen.columns.preparing },
    { key: 'ready', label: t.ordersScreen.columns.ready },
    { key: 'served', label: t.ordersScreen.columns.served },
  ];

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['orders-board'],
    queryFn: () => listOrders({ pageSize: 200 }),
    refetchInterval: 10_000,
  });

  const rows = data?.results ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      r =>
        r.order_number?.toLowerCase().includes(q) ||
        r.customer_name?.toLowerCase().includes(q) ||
        r.table_number?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const grouped = useMemo(() => {
    const byStatus: Record<string, OrderListRow[]> = {};
    for (const row of filtered) {
      const s = resolveOrderStatus(row.status);
      byStatus[s] = byStatus[s] || [];
      byStatus[s].push(row);
    }
    return byStatus;
  }, [filtered]);

  if (isLoading && !data) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.loading}>
          <ActivityIndicator size='large' color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <TopBar title={t.ordersScreen.title} subtitle={`${filtered.length} · auto-refresh 10s`} />
      <View style={styles.headerActions}>
        <View style={styles.searchWrap}>
          <TextInput
            placeholder={t.ordersScreen.search}
            placeholderTextColor={colors.slate400}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            autoCapitalize='none'
            autoCorrect={false}
          />
        </View>
        <Button
          title='↻'
          variant='outline'
          onPress={() => queryClient.invalidateQueries({ queryKey: ['orders-board'] })}
          size='md'
        />
      </View>

      {isTablet ? (
        <View style={styles.board}>
          {COLUMNS.map(col => (
            <Column
              key={col.key}
              label={col.label}
              status={col.key}
              rows={grouped[col.key] ?? []}
              onOpen={id => router.push(`/orders/${id}`)}
            />
          ))}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          renderItem={({ item }) => (
            <OrderCard row={item} onPress={() => router.push(`/orders/${item.id}`)} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t.ordersScreen.empty}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function Column({
  label,
  status,
  rows,
  onOpen,
}: {
  label: string;
  status: OrderStatus;
  rows: OrderListRow[];
  onOpen: (id: string) => void;
}) {
  const tone = COLUMN_TONES[status];
  return (
    <View style={[styles.column, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <View style={[styles.columnHeader, { borderBottomColor: tone.border }]}>
        <View style={[styles.columnDot, { backgroundColor: tone.accent }]} />
        <Text style={[styles.columnLabel, { color: tone.accent }]}>{label}</Text>
        <View style={[styles.countPill, { backgroundColor: tone.accent }]}>
          <Text style={[styles.countText, { color: colors.white }]}>{rows.length}</Text>
        </View>
      </View>
      {rows.length === 0 ? (
        <View style={styles.columnEmpty}>
          <Text style={styles.columnEmptyText}>—</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: spacing.sm, paddingBottom: spacing.md }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => (
            <OrderCard row={item} onPress={() => onOpen(item.id)} compact />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function OrderCard({
  row,
  onPress,
  compact = false,
}: {
  row: OrderListRow;
  onPress: () => void;
  compact?: boolean;
}) {
  const status = resolveOrderStatus(row.status);
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]} onPress={onPress}>
      <View style={styles.cardTop}>
        <Text style={styles.cardNumber}>{row.order_number}</Text>
        <StatusBadge status={status} />
      </View>
      <View style={styles.cardMetaRow}>
        <Text style={styles.cardMeta}>
          {row.table_number ? `Table ${row.table_number}` : row.order_type?.replace('_', ' ')}
        </Text>
        <Text style={styles.cardMeta}>{formatTime(row.created_at)}</Text>
      </View>
      {row.customer_name ? <Text style={styles.cardGuest}>{row.customer_name}</Text> : null}
      <View style={styles.cardFooter}>
        <Text style={styles.cardItems}>
          {row.items_count ? `${row.items_count} items` : compact ? '—' : 'no items'}
        </Text>
        <Text style={styles.cardTotal}>{formatCurrency(row.total)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  searchWrap: {
    minWidth: 260,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    fontSize: typography.sizes.md,
    color: colors.foreground,
    minHeight: 44,
  },
  board: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  column: {
    flex: 1,
    minWidth: 200,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
  },
  columnDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  columnLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    flex: 1,
  },
  countPill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  columnEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  columnEmptyText: {
    fontSize: typography.sizes.md,
    color: colors.slate400,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardNumber: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardMeta: {
    fontSize: typography.sizes.sm,
    color: colors.muted,
  },
  cardGuest: {
    fontSize: typography.sizes.sm,
    color: colors.slate700,
    fontWeight: typography.weights.medium,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  cardItems: {
    fontSize: typography.sizes.sm,
    color: colors.slate500,
  },
  cardTotal: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  listContent: {
    padding: spacing.xl,
  },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyText: { color: colors.muted, fontSize: typography.sizes.md },
});
