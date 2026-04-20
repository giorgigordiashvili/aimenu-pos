import { Ionicons } from '@expo/vector-icons';
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
  getReservation,
  resolveReservationStatus,
  setReservationStatus,
  type ReservationStatus,
} from '@/api/reservations';
import Button from '@/components/Button';
import StatusBadge from '@/components/StatusBadge';
import { useLocale } from '@/i18n';
import { colors, radius, shadows, spacing, typography } from '@/theme/tokens';

const ADVANCE: Partial<Record<ReservationStatus, { next: ReservationStatus; key: 'markSeated' | 'markCompleted' }>> = {
  pending: { next: 'confirmed', key: 'markSeated' },
  confirmed: { next: 'seated', key: 'markSeated' },
  seated: { next: 'completed', key: 'markCompleted' },
};

function formatTime(t: string): string {
  return t?.slice(0, 5) ?? '';
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

function formatDateTime(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale === 'ka' ? 'ka-GE' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function ReservationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t, locale } = useLocale();

  const { data, isLoading } = useQuery({
    queryKey: ['reservation', id],
    queryFn: () => getReservation(id!),
    enabled: !!id,
  });

  const advance = useMutation({
    mutationFn: (next: ReservationStatus) => setReservationStatus(id!, next),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservation', id] });
      qc.invalidateQueries({ queryKey: ['reservations-today'] });
      qc.invalidateQueries({ queryKey: ['reservations-upcoming'] });
    },
  });

  const cancel = useMutation({
    mutationFn: () => setReservationStatus(id!, 'cancelled'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations-today'] });
      qc.invalidateQueries({ queryKey: ['reservations-upcoming'] });
      router.back();
    },
  });

  const noShow = useMutation({
    mutationFn: () => setReservationStatus(id!, 'no_show'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservation', id] });
      qc.invalidateQueries({ queryKey: ['reservations-today'] });
    },
  });

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size='large' />
        </View>
      </SafeAreaView>
    );
  }

  const status = resolveReservationStatus(data.status);
  const next = ADVANCE[status];
  const isTerminal = status === 'completed' || status === 'cancelled' || status === 'no_show';
  const typeLabel = t.reservationCard.reservationOnly;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <Text style={styles.title}>{t.reservationDetails.title}</Text>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name='close' size={20} color={colors.slate700} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.chipsRow}>
          <View style={styles.chipNeutral}>
            <Text style={styles.chipNeutralText}>ID:{data.confirmation_code}</Text>
          </View>
          <View style={styles.chipNeutral}>
            <Ionicons name='bag-handle-outline' size={12} color={colors.slate700} />
            <Text style={styles.chipNeutralText}>{typeLabel}</Text>
          </View>
          <View style={{ marginLeft: 'auto' }}>
            <StatusBadge
              status={status}
              kind='reservation'
              label={data.status_display ?? status}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t.reservationDetails.guestInfo}</Text>
          <IconRow icon='person-outline' iconColor={colors.accent}>
            {data.guest_name}
          </IconRow>
          <IconRow icon='call-outline' iconColor={colors.success}>
            {data.guest_phone}
          </IconRow>
          {data.guest_email ? (
            <IconRow icon='mail-outline' iconColor={colors.warning}>
              {data.guest_email}
            </IconRow>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t.reservationDetails.reservationInfo}</Text>
          <IconRow icon='calendar-outline' iconColor={colors.warning}>
            {formatDate(data.reservation_date, locale)}
          </IconRow>
          <IconRow icon='time-outline' iconColor={colors.accent}>
            {formatTime(data.reservation_time)}
          </IconRow>
          <IconRow icon='people-outline' iconColor={colors.success}>
            {data.party_size} {t.reservationCard.guests}
          </IconRow>
          {data.table_number ? (
            <IconRow icon='grid-outline' iconColor={colors.primary}>
              #{data.table_number}
            </IconRow>
          ) : null}
        </View>

        {data.special_requests ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteTitle}>{t.reservationDetails.specialRequests}</Text>
            <Text style={styles.noteText}>{data.special_requests}</Text>
          </View>
        ) : null}

        <Text style={styles.timestamp}>
          {t.reservationDetails.createdAt} {formatDateTime(data.created_at, locale)}
        </Text>

        {!isTerminal && (
          <View style={styles.actions}>
            <Button
              title={t.reservationDetails.cancel}
              variant='danger'
              size='lg'
              style={{ flex: 1 }}
              loading={cancel.isPending}
              onPress={() => cancel.mutate()}
            />
            {next ? (
              <Button
                title={t.reservationDetails[next.key]}
                variant='success'
                size='lg'
                style={{ flex: 1 }}
                loading={advance.isPending}
                onPress={() => advance.mutate(next.next)}
              />
            ) : null}
          </View>
        )}
        {!isTerminal ? (
          <Button
            title={t.reservationDetails.markNoShow}
            variant='outline'
            size='md'
            fullWidth
            loading={noShow.isPending}
            onPress={() => noShow.mutate()}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function IconRow({
  icon,
  iconColor,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: iconColor + '22' }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={styles.rowText}>{children}</Text>
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
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.sm,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    fontSize: typography.sizes.md,
    color: colors.foreground,
  },
  noteBox: {
    backgroundColor: colors.highlight,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  noteTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.warningDark,
    marginBottom: spacing.xs,
  },
  noteText: {
    fontSize: typography.sizes.sm,
    color: colors.warningDark,
  },
  timestamp: {
    fontSize: typography.sizes.xs,
    color: colors.muted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
