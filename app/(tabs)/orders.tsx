import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  getOrder,
  listOrders,
  resolveOrderStatus,
  updateOrderStatus,
  type OrderListRow,
  type OrderStatus,
} from '@/api/orders';
import Button from '@/components/Button';
import StatusBadge from '@/components/StatusBadge';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/i18n';
import { printReceipt } from '@/lib/printReceipt';
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

type TopTab = 'active' | 'history';

// Plain-CSS style objects used only on the web DnD path (@hello-pangea/dnd
// needs DOM elements with innerRef). Kept out of StyleSheet.create because
// that API emits React-Native-specific primitives.
const webBoardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  gap: spacing.md,
  padding: `0 ${spacing.xl}px ${spacing.lg}px`,
  alignItems: 'stretch',
  flex: 1,
  minHeight: 0,
};
const webColumnStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 220,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderStyle: 'solid',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};
const webColumnHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.sm,
  padding: `${spacing.md}px ${spacing.md}px`,
  borderBottomWidth: 1,
  borderBottomStyle: 'solid',
  fontSize: typography.sizes.md,
  fontWeight: typography.weights.bold,
};
const webColumnDotStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 5,
};
const webColumnLabelStyle: React.CSSProperties = {
  flex: 1,
  fontWeight: typography.weights.bold,
};
const webColumnCountStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: '2px 8px',
  color: '#fff',
  fontSize: typography.sizes.xs,
  fontWeight: typography.weights.bold,
  minWidth: 24,
  textAlign: 'center',
};
const webColumnBodyStyle: React.CSSProperties = {
  flex: 1,
  padding: spacing.sm,
  minHeight: 120,
  overflowY: 'auto',
};
const webColumnEmptyStyle: React.CSSProperties = {
  color: colors.slate400,
  padding: spacing.lg,
  textAlign: 'center',
  fontSize: typography.sizes.md,
};

export default function OrdersScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { restaurantSlug } = useAuth();
  const { width } = useWindowDimensions();
  const isTablet = width >= 1024;
  const [search, setSearch] = useState('');
  const [topTab, setTopTab] = useState<TopTab>('active');
  const t = useT();

  const moveMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) =>
      updateOrderStatus(orderId, status),
    onMutate: async ({ orderId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['orders-board'] });
      const previous = queryClient.getQueryData(['orders-board']);
      queryClient.setQueryData(['orders-board'], (old: unknown) => {
        if (!old || typeof old !== 'object' || !('results' in old)) return old;
        const cast = old as { results: OrderListRow[] };
        return {
          ...old,
          results: cast.results.map(r => (r.id === orderId ? { ...r, status } : r)),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['orders-board'], ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-board'] });
      queryClient.invalidateQueries({ queryKey: ['orders-history'] });
      queryClient.invalidateQueries({ queryKey: ['reservations-today'] });
      queryClient.invalidateQueries({ queryKey: ['reservations-upcoming'] });
    },
  });

  function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }
    const targetStatus = destination.droppableId as OrderStatus;
    moveMutation.mutate({ orderId: draggableId, status: targetStatus });
  }
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
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    enabled: topTab === 'active',
  });

  const history = useQuery({
    queryKey: ['orders-history'],
    queryFn: () =>
      listOrders({
        status: 'completed',
        pageSize: 100,
        includePendingReservations: true,
      }),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    enabled: topTab === 'history',
  });

  const finishMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const fullOrder = await getOrder(orderId);
      try {
        await printReceipt(fullOrder, restaurantSlug);
      } catch {
        // print failure shouldn't block the status transition
      }
      return updateOrderStatus(orderId, 'completed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-board'] });
      queryClient.invalidateQueries({ queryKey: ['orders-history'] });
      queryClient.invalidateQueries({ queryKey: ['reservations-today'] });
      queryClient.invalidateQueries({ queryKey: ['reservations-upcoming'] });
    },
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

  const historyRows = history.data?.results ?? [];
  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return historyRows;
    return historyRows.filter(
      r =>
        r.order_number?.toLowerCase().includes(q) ||
        r.customer_name?.toLowerCase().includes(q) ||
        r.table_number?.toLowerCase().includes(q)
    );
  }, [historyRows, search]);

  if (isLoading && !data && topTab === 'active') {
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
      <TopBar
        title={t.ordersScreen.title}
        subtitle={
          topTab === 'active'
            ? `${filtered.length} · auto-refresh 10s`
            : `${filteredHistory.length}`
        }
      />
      <View style={styles.headerActions}>
        <View style={styles.topTabs}>
          <TopTabButton
            active={topTab === 'active'}
            label={t.ordersScreen.active}
            onPress={() => setTopTab('active')}
          />
          <TopTabButton
            active={topTab === 'history'}
            label={t.ordersScreen.history}
            onPress={() => setTopTab('history')}
          />
        </View>
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
          title={t.loyalty.openButton}
          variant='outline'
          onPress={() => router.push('/loyalty/redeem')}
          size='md'
        />
        <Button
          title='↻'
          variant='outline'
          onPress={() =>
            queryClient.invalidateQueries({
              queryKey: [topTab === 'active' ? 'orders-board' : 'orders-history'],
            })
          }
          size='md'
        />
      </View>

      {topTab === 'history' ? (
        <FlatList
          data={filteredHistory}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={history.isRefetching} onRefresh={() => history.refetch()} />
          }
          renderItem={({ item }) => (
            <OrderCard row={item} onPress={() => router.push(`/orders/${item.id}`)} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t.ordersScreen.emptyHistory}</Text>
            </View>
          }
        />
      ) : isTablet && Platform.OS === 'web' ? (
        <>
          <Text style={styles.dragHint}>{t.ordersScreen.dragHint}</Text>
          <DragDropContext onDragEnd={handleDragEnd}>
            <div style={webBoardStyle}>
              {COLUMNS.map(col => {
                const tone = COLUMN_TONES[col.key];
                const rowsForCol = grouped[col.key] ?? [];
                return (
                  <Droppable droppableId={col.key} key={col.key}>
                    {(dropProvided, dropSnapshot) => (
                      <div
                        ref={dropProvided.innerRef}
                        {...dropProvided.droppableProps}
                        style={{
                          ...webColumnStyle,
                          backgroundColor: tone.bg,
                          borderColor: tone.border,
                          outline: dropSnapshot.isDraggingOver
                            ? `2px solid ${tone.accent}`
                            : 'none',
                        }}
                      >
                        <div
                          style={{
                            ...webColumnHeaderStyle,
                            borderBottomColor: tone.border,
                          }}
                        >
                          <span style={{ ...webColumnDotStyle, backgroundColor: tone.accent }} />
                          <span style={{ ...webColumnLabelStyle, color: tone.accent }}>
                            {col.label}
                          </span>
                          <span style={{ ...webColumnCountStyle, backgroundColor: tone.accent }}>
                            {rowsForCol.length}
                          </span>
                        </div>

                        <div style={webColumnBodyStyle}>
                          {rowsForCol.length === 0 ? (
                            <div style={webColumnEmptyStyle}>—</div>
                          ) : (
                            rowsForCol.map((item, idx) => (
                              <Draggable
                                draggableId={item.id}
                                index={idx}
                                key={item.id}
                              >
                                {(dragProvided, dragSnapshot) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    style={{
                                      ...dragProvided.draggableProps.style,
                                      marginBottom: spacing.sm,
                                      boxShadow: dragSnapshot.isDragging
                                        ? '0 8px 20px rgba(0,0,0,0.18)'
                                        : undefined,
                                    }}
                                  >
                                    <OrderCard
                                      row={item}
                                      onPress={() => router.push(`/orders/${item.id}`)}
                                      compact
                                      onFinish={
                                        col.key === 'served'
                                          ? () => finishMutation.mutate(item.id)
                                          : undefined
                                      }
                                      finishLabel={t.ordersScreen.finishShort}
                                      isFinishing={finishMutation.isPending}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))
                          )}
                          {dropProvided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          </DragDropContext>
        </>
      ) : isTablet ? (
        <View style={styles.board}>
          {COLUMNS.map(col => (
            <Column
              key={col.key}
              label={col.label}
              status={col.key}
              rows={grouped[col.key] ?? []}
              onOpen={id => router.push(`/orders/${id}`)}
              onFinish={
                col.key === 'served'
                  ? id => finishMutation.mutate(id)
                  : undefined
              }
              finishLabel={t.ordersScreen.finishShort}
              isFinishing={finishMutation.isPending}
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
            <OrderCard
              row={item}
              onPress={() => router.push(`/orders/${item.id}`)}
              onFinish={
                resolveOrderStatus(item.status) === 'served'
                  ? () => finishMutation.mutate(item.id)
                  : undefined
              }
              finishLabel={t.ordersScreen.finishShort}
              isFinishing={finishMutation.isPending}
            />
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

function TopTabButton({
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
      style={[styles.topTabBtn, active && styles.topTabBtnActive]}
    >
      <Text style={[styles.topTabBtnText, active && styles.topTabBtnTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Column({
  label,
  status,
  rows,
  onOpen,
  onFinish,
  finishLabel,
  isFinishing,
}: {
  label: string;
  status: OrderStatus;
  rows: OrderListRow[];
  onOpen: (id: string) => void;
  onFinish?: (orderId: string) => void;
  finishLabel?: string;
  isFinishing?: boolean;
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
            <OrderCard
              row={item}
              onPress={() => onOpen(item.id)}
              compact
              onFinish={onFinish ? () => onFinish(item.id) : undefined}
              finishLabel={finishLabel}
              isFinishing={isFinishing}
            />
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
  onFinish,
  finishLabel,
  isFinishing,
}: {
  row: OrderListRow;
  onPress: () => void;
  compact?: boolean;
  onFinish?: () => void;
  finishLabel?: string;
  isFinishing?: boolean;
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
      {onFinish ? (
        <Button
          title={finishLabel ?? 'Finish'}
          variant='primary'
          size='sm'
          fullWidth
          loading={isFinishing}
          onPress={onFinish}
        />
      ) : null}
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
    flexWrap: 'wrap',
  },
  topTabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.slate100,
    borderRadius: radius.pill,
    padding: 4,
  },
  topTabBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
  topTabBtnActive: {
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  topTabBtnText: {
    fontSize: typography.sizes.sm,
    color: colors.mutedStrong,
    fontWeight: typography.weights.medium,
  },
  topTabBtnTextActive: {
    color: colors.foreground,
    fontWeight: typography.weights.semibold,
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
  dragHint: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
    fontSize: typography.sizes.xs,
    color: colors.muted,
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
