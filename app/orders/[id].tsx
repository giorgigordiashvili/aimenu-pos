import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getOrder,
  resolveOrderStatus,
  updateOrderStatus,
  type OrderStatus,
} from '@/api/orders';
import Button from '@/components/Button';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/i18n';
import { printReceipt } from '@/lib/printReceipt';
import { colors, radius, shadows, spacing, typography } from '@/theme/tokens';

function formatCurrency(raw: string | undefined | null): string {
  if (!raw) return '—';
  const n = parseFloat(raw);
  return `${n.toFixed(2)} ₾`;
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useT();
  const { restaurantSlug } = useAuth();
  const ADVANCE: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
    pending: { next: 'confirmed', label: t.orderDetail.actions.accept },
    confirmed: { next: 'preparing', label: t.orderDetail.actions.startPrep },
    preparing: { next: 'ready', label: t.orderDetail.actions.markReady },
    ready: { next: 'served', label: t.orderDetail.actions.markServed },
    served: { next: 'completed', label: t.orderDetail.actions.complete },
  };

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id!),
    enabled: !!id,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });

  const invalidateOnOrderChange = () => {
    queryClient.invalidateQueries({ queryKey: ['order', id] });
    queryClient.invalidateQueries({ queryKey: ['orders-board'] });
    queryClient.invalidateQueries({ queryKey: ['orders-history'] });
    // pre_order_summary on reservation list cards is derived from Order.total.
    queryClient.invalidateQueries({ queryKey: ['reservations-today'] });
    queryClient.invalidateQueries({ queryKey: ['reservations-upcoming'] });
  };

  const advance = useMutation({
    mutationFn: (next: OrderStatus) => updateOrderStatus(id!, next),
    onSuccess: invalidateOnOrderChange,
  });

  const cancel = useMutation({
    mutationFn: () => updateOrderStatus(id!, 'cancelled'),
    onSuccess: () => {
      invalidateOnOrderChange();
      router.back();
    },
  });

  const finish = useMutation({
    mutationFn: async () => {
      const fresh = await getOrder(id!);
      try {
        await printReceipt(fresh, restaurantSlug);
      } catch {
        // printing failure shouldn't block the status transition
      }
      return updateOrderStatus(id!, 'completed');
    },
    onSuccess: invalidateOnOrderChange,
  });

  const reprint = useMutation({
    mutationFn: async () => {
      const fresh = await getOrder(id!);
      await printReceipt(fresh, restaurantSlug);
    },
  });

  if (isLoading || !order) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.loading}>
          <ActivityIndicator size='large' color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const status = resolveOrderStatus(order.status);
  const next = ADVANCE[status];
  const isTerminal = status === 'completed' || status === 'cancelled';

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← {t.reservationDetails.back}</Text>
        </Pressable>
        <StatusBadge status={status} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.orderNumber}>{order.order_number}</Text>
          <Text style={styles.meta}>
            {order.order_type?.replace('_', ' ')} · {order.table_number ? `Table ${order.table_number}` : '—'}
          </Text>
          {order.customer_name ? (
            <Text style={styles.guest}>{order.customer_name}</Text>
          ) : null}
          {order.customer_phone ? (
            <Text style={styles.muted}>{order.customer_phone}</Text>
          ) : null}
          {order.customer_notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>{t.orderDetail.notes}</Text>
              <Text style={styles.notesText}>{order.customer_notes}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t.orderDetail.items}</Text>
          {order.items?.length === 0 ? (
            <Text style={styles.muted}>No items attached.</Text>
          ) : (
            order.items.map(item => (
              <View key={item.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>
                    {(item.quantity ?? 1)}× {item.item_name}
                  </Text>
                  {item.modifiers?.length > 0 ? (
                    <Text style={styles.itemSub}>
                      {item.modifiers.map(m => m.modifier_name).join(', ')}
                    </Text>
                  ) : null}
                  {item.special_instructions ? (
                    <Text style={styles.itemSub}>{item.special_instructions}</Text>
                  ) : null}
                </View>
                <Text style={styles.itemPrice}>{formatCurrency(item.total_price)}</Text>
              </View>
            ))
          )}
          <View style={styles.totalsDivider} />
          <Row label={t.orderDetail.subtotal} value={formatCurrency(order.subtotal)} />
          {order.tax_amount && parseFloat(order.tax_amount) > 0 ? (
            <Row label={t.orderDetail.tax} value={formatCurrency(order.tax_amount)} />
          ) : null}
          {order.service_charge && parseFloat(order.service_charge) > 0 ? (
            <Row label={t.orderDetail.serviceCharge} value={formatCurrency(order.service_charge)} />
          ) : null}
          {order.tip_amount && parseFloat(order.tip_amount) > 0 ? (
            <Row label={t.orderDetail.tip} value={formatCurrency(order.tip_amount)} />
          ) : null}
          <Row label={t.orderDetail.total} value={formatCurrency(order.total)} emphasised />
        </View>

        {!isTerminal && (
          <View style={styles.actions}>
            {status === 'served' ? (
              <Button
                title={t.ordersScreen.finish}
                variant='primary'
                size='lg'
                fullWidth
                loading={finish.isPending}
                onPress={() => finish.mutate()}
              />
            ) : next ? (
              <Button
                title={next.label}
                variant='success'
                size='lg'
                fullWidth
                loading={advance.isPending}
                onPress={() => advance.mutate(next.next)}
              />
            ) : null}
            <Button
              title={t.orderDetail.cancelOrder}
              variant='danger'
              size='lg'
              fullWidth
              loading={cancel.isPending}
              onPress={() => cancel.mutate()}
            />
          </View>
        )}

        {status === 'completed' ? (
          <View style={styles.actions}>
            <Button
              title={t.ordersScreen.printReceipt}
              variant='outline'
              size='lg'
              fullWidth
              loading={reprint.isPending}
              onPress={() => reprint.mutate()}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  emphasised = false,
}: {
  label: string;
  value: string;
  emphasised?: boolean;
}) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, emphasised && { fontWeight: typography.weights.bold }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.totalValue,
          emphasised && {
            fontSize: typography.sizes.xl,
            color: colors.primary,
            fontWeight: typography.weights.bold,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  back: {
    paddingVertical: spacing.sm,
  },
  backText: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  header: { gap: spacing.xs },
  orderNumber: {
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  meta: { fontSize: typography.sizes.md, color: colors.muted },
  guest: {
    marginTop: spacing.sm,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  muted: { fontSize: typography.sizes.sm, color: colors.muted },
  notesBox: {
    marginTop: spacing.md,
    backgroundColor: colors.warningTint,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  notesLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.warning,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesText: { fontSize: typography.sizes.md, color: colors.foreground, marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  itemName: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.foreground },
  itemSub: { fontSize: typography.sizes.sm, color: colors.muted, marginTop: 2 },
  itemPrice: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.foreground },
  totalsDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  totalLabel: { fontSize: typography.sizes.md, color: colors.muted },
  totalValue: { fontSize: typography.sizes.md, color: colors.foreground, fontWeight: typography.weights.semibold },
  actions: { gap: spacing.md },
});
