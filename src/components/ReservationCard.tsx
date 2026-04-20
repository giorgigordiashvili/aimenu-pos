import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Reservation, ReservationStatus } from '@/api/reservations';
import { resolveReservationStatus } from '@/api/reservations';
import Button from '@/components/Button';
import StatusBadge from '@/components/StatusBadge';
import type { Dict } from '@/i18n';
import { colors, radius, shadows, spacing, typography } from '@/theme/tokens';

interface Props {
  row: Reservation;
  t: Dict;
  locale: string;
  onPress: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onSeated?: () => void;
  onComplete?: () => void;
  isMutating?: boolean;
}

function formatDate(d: string, locale: string): string {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString(locale === 'ka' ? 'ka-GE' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

function formatTime(t: string): string {
  return t?.slice(0, 5) ?? '';
}

function formatAmount(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return undefined;
  return n.toFixed(2);
}

export default function ReservationCard({
  row,
  t,
  locale,
  onPress,
  onAccept,
  onReject,
  onSeated,
  onComplete,
  isMutating,
}: Props) {
  const status: ReservationStatus = resolveReservationStatus(row.status);
  const summary = row.pre_order_summary ?? null;
  const detailPreOrder = row.pre_order ?? null;
  const hasOrder = !!summary || (!!detailPreOrder && (detailPreOrder.items?.length ?? 0) > 0);
  const total = formatAmount(summary?.total ?? detailPreOrder?.total);
  const menu = formatAmount(summary?.subtotal ?? detailPreOrder?.subtotal);
  const typeLabel = hasOrder ? t.reservationCard.reservationPlusOrder : t.reservationCard.reservationOnly;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.96 }]}
    >
      <View style={styles.header}>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <View style={styles.headerTop}>
            <Text style={styles.guestName} numberOfLines={1}>
              {row.guest_name}
            </Text>
            <StatusBadge
              status={status}
              kind='reservation'
              label={row.status_display ?? status}
            />
          </View>
          <View style={styles.phoneRow}>
            <Ionicons name='call-outline' size={14} color={colors.muted} />
            <Text style={styles.phoneText}>{row.guest_phone}</Text>
          </View>
        </View>
      </View>

      <View style={styles.chipsRow}>
        <View style={styles.chipNeutral}>
          <Text style={styles.chipNeutralText}>ID:{row.confirmation_code}</Text>
        </View>
        <View style={styles.chipNeutral}>
          <Ionicons name='bag-handle-outline' size={12} color={colors.slate700} />
          <Text style={styles.chipNeutralText}>{typeLabel}</Text>
        </View>
      </View>

      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        <InfoRow
          icon='calendar-outline'
          color={colors.warning}
          text={formatDate(row.reservation_date, locale)}
        />
        <InfoRow
          icon='time-outline'
          color={colors.accent}
          text={formatTime(row.reservation_time)}
        />
        <InfoRow
          icon='people-outline'
          color={colors.success}
          text={`${row.party_size} ${t.reservationCard.guests}`}
        />
      </View>

      {hasOrder && (
        <View style={styles.orderBox}>
          <View style={styles.orderRow}>
            <Text style={styles.orderLabel}>{t.reservationCard.totalAmount}</Text>
            <Text style={styles.orderValue}>{total} ₾</Text>
          </View>
          {menu ? (
            <View style={styles.orderRow}>
              <Text style={styles.orderSubLabel}>{t.reservationCard.menuValue}</Text>
              <Text style={styles.orderSubValue}>{menu} ₾</Text>
            </View>
          ) : null}
        </View>
      )}

      {row.special_requests ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteText} numberOfLines={3}>
            {row.special_requests}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {status === 'pending' ? (
          <>
            <Button
              title={t.reservationCard.reject}
              variant='danger'
              size='md'
              style={{ flex: 1 }}
              loading={isMutating && !!onReject}
              onPress={onReject}
            />
            <Button
              title={t.reservationCard.confirm}
              variant='success'
              size='md'
              style={{ flex: 1 }}
              loading={isMutating && !!onAccept}
              onPress={onAccept}
            />
          </>
        ) : status === 'confirmed' ? (
          <Button
            title={t.reservationCard.seated}
            variant='success'
            size='md'
            style={{ flex: 1 }}
            loading={isMutating && !!onSeated}
            onPress={onSeated}
          />
        ) : status === 'seated' ? (
          <Button
            title={t.reservationCard.completed}
            variant='success'
            size='md'
            style={{ flex: 1 }}
            loading={isMutating && !!onComplete}
            onPress={onComplete}
          />
        ) : null}
      </View>

      <Pressable onPress={onPress} style={styles.fullInfo}>
        <Text style={styles.fullInfoText}>{t.reservationCard.fullInfo}</Text>
        <Ionicons name='chevron-forward' size={14} color={colors.slate700} />
      </Pressable>
    </Pressable>
  );
}

function InfoRow({
  icon,
  color,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  text: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  guestName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
    flex: 1,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneText: {
    fontSize: typography.sizes.sm,
    color: colors.mutedStrong,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  chipNeutral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.slate100,
  },
  chipNeutralText: {
    fontSize: typography.sizes.xs,
    color: colors.slate700,
    fontWeight: typography.weights.medium,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoText: {
    fontSize: typography.sizes.sm,
    color: colors.mutedStrong,
  },
  orderBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.infoTint,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderLabel: {
    fontSize: typography.sizes.sm,
    color: colors.mutedStrong,
    fontWeight: typography.weights.medium,
  },
  orderValue: {
    fontSize: typography.sizes.md,
    color: colors.foreground,
    fontWeight: typography.weights.bold,
  },
  orderSubLabel: {
    fontSize: typography.sizes.xs,
    color: colors.muted,
  },
  orderSubValue: {
    fontSize: typography.sizes.sm,
    color: colors.mutedStrong,
    fontWeight: typography.weights.semibold,
  },
  noteBox: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.highlight,
    padding: spacing.md,
  },
  noteText: {
    fontSize: typography.sizes.sm,
    color: colors.warningDark,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  fullInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    marginTop: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fullInfoText: {
    fontSize: typography.sizes.sm,
    color: colors.foreground,
    fontWeight: typography.weights.medium,
  },
});
