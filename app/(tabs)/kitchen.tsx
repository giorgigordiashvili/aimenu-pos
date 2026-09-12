import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import {
  listKitchenOrders,
  resolveOrderStatus,
  updateOrderStatus,
  type KitchenOrderRow,
  type OrderStatus,
  type Paginated,
} from "@/api/orders";
import InlineBanner from "@/components/InlineBanner";
import KitchenCancelSheet from "@/components/KitchenCancelSheet";
import KitchenTicket, {
  startedAt,
  type KitchenLane,
} from "@/components/KitchenTicket";
import { useLocale } from "@/i18n";
import {
  isAudioUnlocked,
  loadSoundPref,
  playNewTicketChime,
  saveSoundPref,
  unlockAudio,
} from "@/lib/kitchenSound";
import { printTicket } from "@/api/printing";
import { useNewTicketAlert } from "@/lib/useNewTicketAlert";
import { usePrinters } from "@/lib/usePrinters";
import { useKeepScreenAwake } from "@/lib/useKeepScreenAwake";
import { useNow } from "@/lib/useNow";
import { colors, radius, shadows, spacing, typography } from "@/theme/tokens";

const LANES: KitchenLane[] = ["confirmed", "preparing", "ready"];
const NEXT: Record<KitchenLane, OrderStatus> = {
  confirmed: "preparing",
  preparing: "ready",
  ready: "served",
};
const LANE_TONES: Record<
  KitchenLane,
  { bg: string; border: string; accent: string }
> = {
  confirmed: { bg: colors.infoTint, border: colors.info, accent: colors.info },
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
};

type Board = Paginated<KitchenOrderRow>;
type Vars = { orderId: string; status: OrderStatus; reason?: string };

function apiMessage(err: unknown): string | null {
  const data = (
    err as {
      response?: { data?: { error?: { message?: string }; detail?: string } };
    }
  )?.response?.data;
  return data?.error?.message ?? data?.detail ?? null;
}

/**
 * Kitchen display: tickets the pass is working on, driven by big buttons
 * (Accept → Ready → Picked up) instead of drag-and-drop. New tickets chime
 * and flash; the screen stays awake while it is open.
 */
export default function KitchenScreen() {
  const { t, locale, setLocale } = useLocale();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const isTablet = width >= 1024;
  const [lane, setLane] = useState<KitchenLane>("confirmed");
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<KitchenOrderRow | null>(
    null,
  );
  const [soundOn, setSoundOn] = useState(false);
  const [unlocked, setUnlocked] = useState(() => isAudioUnlocked());
  const now = useNow(30_000);
  useKeepScreenAwake("kitchen");

  useEffect(() => {
    loadSoundPref().then(setSoundOn);
  }, []);

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["kitchen-board"],
    queryFn: () => listKitchenOrders({ pageSize: 100 }),
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

  const grouped = useMemo(() => {
    const g: Record<KitchenLane, KitchenOrderRow[]> = {
      confirmed: [],
      preparing: [],
      ready: [],
    };
    for (const row of data?.results ?? []) {
      const s = resolveOrderStatus(row.status) as KitchenLane;
      if (s in g) g[s].push(row);
    }
    for (const key of LANES) g[key].sort((a, b) => startedAt(a) - startedAt(b));
    return g;
  }, [data]);

  const newIds = useMemo(
    () => grouped.confirmed.map((r) => r.id),
    [grouped.confirmed],
  );
  const { flash } = useNewTicketAlert(newIds, {
    soundOn: soundOn && unlocked,
    ready: !!data,
  });

  const move = useMutation({
    mutationFn: ({ orderId, status, reason }: Vars) =>
      updateOrderStatus(
        orderId,
        status,
        reason ? { cancellationReason: reason } : undefined,
      ),
    onMutate: async ({ orderId, status }) => {
      setBusy((prev) => new Set(prev).add(orderId));
      await qc.cancelQueries({ queryKey: ["kitchen-board"] });
      const previous = qc.getQueryData<Board>(["kitchen-board"]);
      qc.setQueryData<Board>(["kitchen-board"], (old) => {
        if (!old) return old;
        const leaves = status === "served" || status === "cancelled";
        return {
          ...old,
          results: leaves
            ? old.results.filter((r) => r.id !== orderId)
            : old.results.map((r) => (r.id === orderId ? { ...r, status } : r)),
        };
      });
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["kitchen-board"], ctx.previous);
      setError(apiMessage(err) ?? t.kitchen.errorGeneric);
    },
    onSettled: (_data, _err, { orderId }) => {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
      qc.invalidateQueries({ queryKey: ["kitchen-board"] });
      qc.invalidateQueries({ queryKey: ["orders-board"] });
      qc.invalidateQueries({ queryKey: ["orders-history"] });
    },
  });

  const advance = useCallback(
    (row: KitchenOrderRow) => {
      if (busy.has(row.id)) return;
      const current = resolveOrderStatus(row.status) as KitchenLane;
      if (!(current in NEXT)) return;
      move.mutate({ orderId: row.id, status: NEXT[current] });
    },
    [busy, move],
  );

  function toggleSound() {
    const next = !soundOn;
    if (next) {
      unlockAudio(); // must happen inside the tap (browser autoplay policy)
      setUnlocked(isAudioUnlocked());
    }
    setSoundOn(next);
    void saveSoundPref(next);
    if (next) playNewTicketChime();
  }

  function unlockOnTap() {
    if (soundOn && !unlocked) {
      unlockAudio();
      setUnlocked(isAudioUnlocked());
    }
  }

  const hideError = useCallback(() => setError(null), []);
  const { kitchenPrinters } = usePrinters();
  const [printed, setPrinted] = useState<string | null>(null);
  const print = useMutation({
    mutationFn: (orderId: string) => printTicket(orderId),
    onSuccess: () => setPrinted(t.printing.printed),
    onError: (err) => setError(apiMessage(err) ?? t.printing.noPrinter),
  });

  const renderLane = (key: KitchenLane, withRefresh: boolean) => {
    const tone = LANE_TONES[key];
    const rows = grouped[key];
    return (
      <View
        key={key}
        style={[
          styles.lane,
          { backgroundColor: tone.bg, borderColor: tone.border },
        ]}
      >
        <View style={[styles.laneHeader, { borderBottomColor: tone.border }]}>
          <View style={[styles.laneDot, { backgroundColor: tone.accent }]} />
          <Text style={[styles.laneLabel, { color: tone.accent }]}>
            {t.kitchen.lanes[key]}
          </Text>
          <View style={[styles.countPill, { backgroundColor: tone.accent }]}>
            <Text style={styles.countText}>{rows.length}</Text>
          </View>
        </View>
        {rows.length === 0 ? (
          <View style={styles.laneEmpty}>
            <Text style={styles.laneEmptyText}>{t.kitchen.empty}</Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.laneList}
            ItemSeparatorComponent={() => (
              <View style={{ height: spacing.md }} />
            )}
            showsVerticalScrollIndicator={false}
            refreshControl={
              withRefresh ? (
                <RefreshControl
                  refreshing={isRefetching}
                  onRefresh={refetch}
                  tintColor={colors.primary}
                />
              ) : undefined
            }
            renderItem={({ item }) => (
              <KitchenTicket
                row={item}
                lane={key}
                now={now}
                busy={busy.has(item.id)}
                flash={flash.has(item.id)}
                labels={t.kitchen}
                onAdvance={() => advance(item)}
                onCancel={
                  key === "ready" ? undefined : () => setCancelTarget(item)
                }
                onPrint={
                  kitchenPrinters.length > 0
                    ? () => print.mutate(item.id)
                    : undefined
                }
              />
            )}
          />
        )}
      </View>
    );
  };

  const soundLabel = !soundOn
    ? t.kitchen.soundOff
    : unlocked
      ? t.kitchen.soundOn
      : t.kitchen.soundUnlock;

  return (
    <SafeAreaView style={styles.root} onTouchStart={unlockOnTap}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t.kitchen.title}</Text>
          <Text style={styles.subtitle}>{t.kitchen.subtitle}</Text>
        </View>
        <View style={styles.pills}>
          {LANES.map((key) => (
            <View
              key={key}
              style={[styles.pill, { backgroundColor: LANE_TONES[key].bg }]}
            >
              <Text
                style={[styles.pillCount, { color: LANE_TONES[key].accent }]}
              >
                {grouped[key].length}
              </Text>
              <Text style={styles.pillLabel}>{t.kitchen.lanes[key]}</Text>
            </View>
          ))}
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={toggleSound}
            style={[styles.iconBtn, soundOn && unlocked && styles.iconBtnOn]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={soundLabel}
          >
            <Ionicons
              name={soundOn ? "volume-high" : "volume-mute"}
              size={26}
              color={soundOn && unlocked ? colors.white : colors.slate700}
            />
            <Text
              style={[
                styles.iconBtnText,
                soundOn && unlocked && styles.iconBtnTextOn,
              ]}
            >
              {soundLabel}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => refetch()}
            style={styles.iconBtn}
            hitSlop={12}
            accessibilityRole="button"
          >
            {isRefetching ? (
              <ActivityIndicator color={colors.slate700} />
            ) : (
              <Ionicons name="refresh" size={26} color={colors.slate700} />
            )}
          </Pressable>
          <Pressable
            onPress={() => setLocale(locale === "ka" ? "en" : "ka")}
            style={styles.iconBtn}
            hitSlop={12}
            accessibilityRole="button"
          >
            <Text style={styles.localeText}>
              {locale === "ka" ? "EN" : "KA"}
            </Text>
          </Pressable>
        </View>
      </View>

      <InlineBanner message={error} onHide={hideError} />
      <InlineBanner
        message={printed}
        tone="success"
        autoHideMs={2500}
        onHide={() => setPrinted(null)}
      />

      {isLoading && !data ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isTablet ? (
        <View style={styles.board}>
          {LANES.map((key) => renderLane(key, false))}
        </View>
      ) : (
        <View style={styles.phone}>
          <View style={styles.segments}>
            {LANES.map((key) => (
              <Pressable
                key={key}
                onPress={() => setLane(key)}
                style={[styles.segment, lane === key && styles.segmentActive]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    lane === key && styles.segmentTextActive,
                  ]}
                >
                  {t.kitchen.lanes[key]} · {grouped[key].length}
                </Text>
              </Pressable>
            ))}
          </View>
          {renderLane(lane, true)}
        </View>
      )}

      <KitchenCancelSheet
        order={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={(reason) => {
          if (cancelTarget)
            move.mutate({
              orderId: cancelTarget.id,
              status: "cancelled",
              reason,
            });
          setCancelTarget(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  headerText: {
    minWidth: 160,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.muted,
  },
  pills: {
    flexDirection: "row",
    gap: spacing.sm,
    flex: 1,
    flexWrap: "wrap",
  },
  pill: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pillCount: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  pillLabel: {
    fontSize: typography.sizes.sm,
    color: colors.mutedStrong,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  iconBtn: {
    minHeight: 56,
    minWidth: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBtnOn: {
    backgroundColor: colors.successDark,
    borderColor: colors.successDark,
  },
  iconBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.slate700,
  },
  iconBtnTextOn: {
    color: colors.white,
  },
  localeText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.slate700,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  board: {
    flex: 1,
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  phone: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  segments: {
    flexDirection: "row",
    backgroundColor: colors.slate100,
    borderRadius: radius.pill,
    padding: spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  segmentActive: {
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  segmentText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.mutedStrong,
  },
  segmentTextActive: {
    color: colors.foreground,
    fontWeight: typography.weights.bold,
  },
  lane: {
    flex: 1,
    minWidth: 280,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  laneHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
  },
  laneDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  laneLabel: {
    flex: 1,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  countPill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    minWidth: 32,
    alignItems: "center",
  },
  countText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  laneList: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  laneEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
  },
  laneEmptyText: {
    fontSize: typography.sizes.md,
    color: colors.slate400,
  },
});
