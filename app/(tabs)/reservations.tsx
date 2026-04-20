import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  listTodayReservations,
  listUpcomingReservations,
  resolveReservationStatus,
  setReservationStatus,
  type Reservation,
  type ReservationStatus,
} from '@/api/reservations';
import ReservationCard from '@/components/ReservationCard';
import StatsBar from '@/components/StatsBar';
import TopBar from '@/components/TopBar';
import { useLocale } from '@/i18n';
import { colors, radius, shadows, spacing, typography } from '@/theme/tokens';

type Tab = 'all' | 'pending' | 'confirmed';

export default function ReservationsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('all');
  const { t, locale } = useLocale();
  const { width } = useWindowDimensions();
  const qc = useQueryClient();

  const today = useQuery({
    queryKey: ['reservations-today'],
    queryFn: () => listTodayReservations(),
    refetchInterval: 30_000,
  });
  const upcoming = useQuery({
    queryKey: ['reservations-upcoming'],
    queryFn: () => listUpcomingReservations(),
    refetchInterval: 60_000,
  });

  const todayRows = today.data?.results ?? [];
  const upcomingRows = upcoming.data?.results ?? [];
  const isLoading = today.isLoading && !today.data;
  const isRefreshing = today.isRefetching || upcoming.isRefetching;

  const stats = useMemo(() => {
    const pending = todayRows.filter(r => resolveReservationStatus(r.status) === 'pending').length;
    const confirmed = todayRows.filter(
      r => resolveReservationStatus(r.status) === 'confirmed'
    ).length;
    return { pending, confirmed, today: todayRows.length };
  }, [todayRows]);

  const filtered = useMemo(() => {
    const base = [...todayRows, ...upcomingRows];
    const seen = new Set<string>();
    const unique = base.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    if (tab === 'pending') {
      return unique.filter(r => resolveReservationStatus(r.status) === 'pending');
    }
    if (tab === 'confirmed') {
      return unique.filter(r => resolveReservationStatus(r.status) === 'confirmed');
    }
    const terminal: ReservationStatus[] = ['cancelled', 'no_show', 'completed'];
    return unique.filter(r => !terminal.includes(resolveReservationStatus(r.status)));
  }, [todayRows, upcomingRows, tab]);

  const mutate = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReservationStatus }) =>
      setReservationStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations-today'] });
      qc.invalidateQueries({ queryKey: ['reservations-upcoming'] });
      qc.invalidateQueries({ queryKey: ['reservation'] });
    },
  });

  const columns = width >= 1280 ? 3 : width >= 900 ? 2 : 1;
  const cardWidth = columns === 1 ? '100%' : `${100 / columns - 1}%`;

  function counts() {
    const all = filtered.length;
    const pending = [...todayRows, ...upcomingRows].filter(
      r => resolveReservationStatus(r.status) === 'pending'
    ).length;
    const confirmed = [...todayRows, ...upcomingRows].filter(
      r => resolveReservationStatus(r.status) === 'confirmed'
    ).length;
    return { all, pending, confirmed };
  }
  const c = counts();

  return (
    <SafeAreaView style={styles.root}>
      <TopBar title={t.dashboard.title} subtitle={t.dashboard.subtitle} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              today.refetch();
              upcoming.refetch();
            }}
          />
        }
      >
        <StatsBar
          pending={stats.pending}
          confirmed={stats.confirmed}
          todayTotal={stats.today}
          labels={{
            pending: t.dashboard.stats.pending,
            confirmed: t.dashboard.stats.confirmed,
            today: t.dashboard.stats.today,
          }}
        />
        <View style={styles.tabs}>
          <TabButton
            active={tab === 'all'}
            label={`${t.dashboard.tabs.allActive} (${c.all})`}
            onPress={() => setTab('all')}
          />
          <TabButton
            active={tab === 'pending'}
            label={`${t.dashboard.tabs.pending} (${c.pending})`}
            onPress={() => setTab('pending')}
          />
          <TabButton
            active={tab === 'confirmed'}
            label={`${t.dashboard.tabs.confirmed} (${c.confirmed})`}
            onPress={() => setTab('confirmed')}
          />
        </View>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} size='large' />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t.dashboard.empty}</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filtered.map((row: Reservation) => {
              const status = resolveReservationStatus(row.status);
              const isMutating = mutate.isPending && mutate.variables?.id === row.id;
              return (
                <View key={row.id} style={[styles.gridItem, { width: cardWidth as any }]}>
                  <ReservationCard
                    row={row}
                    t={t}
                    locale={locale}
                    onPress={() => router.push(`/reservations/${row.id}`)}
                    onAccept={
                      status === 'pending'
                        ? () => mutate.mutate({ id: row.id, status: 'confirmed' })
                        : undefined
                    }
                    onReject={
                      status === 'pending'
                        ? () => mutate.mutate({ id: row.id, status: 'cancelled' })
                        : undefined
                    }
                    onSeated={
                      status === 'confirmed'
                        ? () => mutate.mutate({ id: row.id, status: 'seated' })
                        : undefined
                    }
                    onComplete={
                      status === 'seated'
                        ? () => mutate.mutate({ id: row.id, status: 'completed' })
                        : undefined
                    }
                    isMutating={isMutating}
                  />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabButton({
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
      style={[styles.tabBtn, active && styles.tabBtnActive]}
    >
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingBottom: spacing.xxxl,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    flexWrap: 'wrap',
  },
  tabBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabBtnActive: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
    ...shadows.sm,
  },
  tabBtnText: {
    fontSize: typography.sizes.sm,
    color: colors.mutedStrong,
    fontWeight: typography.weights.medium,
  },
  tabBtnTextActive: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
  },
  loading: { paddingVertical: spacing.xxxl, alignItems: 'center' },
  empty: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.muted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    padding: spacing.xl,
  },
  gridItem: {
    minWidth: 280,
  },
});
