import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { OrderStatus } from '@/api/orders';
import type { ReservationStatus } from '@/api/reservations';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const orderTone: Record<OrderStatus, { bg: string; fg: string }> = {
  pending_payment: { bg: colors.warningTint, fg: colors.warningDark },
  pending: { bg: colors.warningTint, fg: colors.warningDark },
  confirmed: { bg: colors.successTint, fg: colors.successDark },
  preparing: { bg: '#FFEDD4', fg: colors.warningDark },
  ready: { bg: colors.successTint, fg: colors.successDark },
  served: { bg: colors.slate100, fg: colors.slate700 },
  completed: { bg: colors.successTint, fg: colors.successDark },
  cancelled: { bg: colors.dangerTint, fg: colors.danger },
};

const reservationTone: Record<ReservationStatus, { bg: string; fg: string }> = {
  pending_payment: { bg: colors.warningTint, fg: colors.warningDark },
  pending: { bg: colors.warningTint, fg: colors.warningDark },
  confirmed: { bg: colors.successTint, fg: colors.successDark },
  waitlist: { bg: colors.slate100, fg: colors.slate700 },
  seated: { bg: colors.successTint, fg: colors.successDark },
  completed: { bg: colors.successTint, fg: colors.successDark },
  cancelled: { bg: colors.dangerTint, fg: colors.danger },
  no_show: { bg: colors.dangerTint, fg: colors.danger },
};

interface Props {
  status: OrderStatus | ReservationStatus;
  kind?: 'order' | 'reservation';
  label?: string;
}

export default function StatusBadge({ status, kind = 'order', label }: Props) {
  const palette =
    kind === 'reservation'
      ? (reservationTone[status as ReservationStatus] ?? reservationTone.pending)
      : (orderTone[status as OrderStatus] ?? orderTone.pending);
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.label, { color: palette.fg }]}>
        {label ?? status.replace(/_/g, ' ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
});
