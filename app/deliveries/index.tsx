import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  FlatList,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import {
  listDeliveries,
  myCourier,
  setMyAvailability,
  updateDelivery,
  type Delivery,
} from "@/api/ordering";
import { can } from "@/api/restaurants";
import Button from "@/components/Button";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/i18n";
import { money } from "@/lib/money";
import { colors, radius, spacing, typography } from "@/theme/tokens";

function hhmm(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function openMaps(d: Delivery) {
  const q =
    d.lat && d.lng ? `${d.lat},${d.lng}` : encodeURIComponent(d.address || "");
  const url =
    Platform.OS === "ios"
      ? `maps://?q=${q}`
      : `https://www.google.com/maps/search/?api=1&query=${q}`;
  Linking.openURL(url).catch(() => {});
}

/** Courier mode: the rider's own deliveries (managers see all open ones). */
export default function DeliveriesScreen() {
  const { t } = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const { currentRestaurant } = useAuth();
  const manager = can(currentRestaurant, "orders", "update");
  const me = useQuery({ queryKey: ["courier-me"], queryFn: myCourier });
  const mine = !manager || !!me.data;
  const list = useQuery({
    queryKey: ["deliveries", mine ? "mine" : "all"],
    queryFn: () => listDeliveries({ status: "open", mine }),
    refetchInterval: 15_000,
  });
  const availability = useMutation({
    mutationFn: (v: boolean) => setMyAvailability(v),
    onSuccess: (row) => qc.setQueryData(["courier-me"], row),
  });
  const move = useMutation({
    mutationFn: ({
      orderId,
      status,
    }: {
      orderId: string;
      status: "picked_up" | "delivered";
    }) => updateDelivery(orderId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      qc.invalidateQueries({ queryKey: ["orders-board"] });
    },
  });
  const rows = list.data ?? [];

  return (
    <SafeAreaView style={styles.root}>
      <TopBar title={t.ordering.myDeliveries} subtitle={`${rows.length}`} />
      <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12}>
        <Ionicons name="chevron-back" size={18} color={colors.foreground} />
        <Text style={styles.backText}>{t.common.close}</Text>
      </Pressable>
      {me.data ? (
        <View style={styles.availRow}>
          <Text style={styles.availText}>
            {me.data.is_available ? t.ordering.onShift : t.ordering.offShift}
          </Text>
          <Switch
            value={me.data.is_available}
            onValueChange={(v) => availability.mutate(v)}
            testID="courier-availability"
          />
        </View>
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        refreshing={list.isRefetching}
        onRefresh={() => list.refetch()}
        ListEmptyComponent={
          <Text style={styles.empty}>{t.ordering.noDeliveries}</Text>
        }
        renderItem={({ item: d }) => (
          <View style={styles.card} testID={`delivery-${d.order_number}`}>
            <View style={styles.cardTop}>
              <Text style={styles.number}>{d.order_number}</Text>
              <Text style={styles.status}>
                {(t.ordering.status as Record<string, string>)[d.status] ??
                  d.status}
                {d.scheduled_for ? ` · ${hhmm(d.scheduled_for)}` : ""}
              </Text>
            </View>
            <Text style={styles.name}>
              {d.customer_name} · {d.customer_phone}
            </Text>
            <Text style={styles.addr}>{d.address}</Text>
            {Object.keys(d.address_json ?? {}).length ? (
              <Text style={styles.muted}>
                {["entrance", "floor", "apartment"]
                  .filter((k) => d.address_json[k])
                  .map(
                    (k) =>
                      `${(t.ordering.address as Record<string, string>)[k]} ${d.address_json[k]}`,
                  )
                  .join(" · ")}
              </Text>
            ) : null}
            {d.instructions ? (
              <Text style={styles.muted}>“{d.instructions}”</Text>
            ) : null}
            <Text style={styles.muted}>
              {money(d.total)} ·{" "}
              {d.is_paid ? t.ordering.paid : t.ordering.collectCash}
              {d.courier_name ? ` · ${d.courier_name}` : ""}
            </Text>
            <View style={styles.actions}>
              <Button
                title={t.ordering.navigate}
                variant="outline"
                size="sm"
                onPress={() => openMaps(d)}
              />
              {d.customer_phone ? (
                <Button
                  title={t.ordering.call}
                  variant="outline"
                  size="sm"
                  onPress={() => Linking.openURL(`tel:${d.customer_phone}`)}
                />
              ) : null}
              {d.provider === "own" && d.status === "assigned" ? (
                <Button
                  title={t.ordering.markPickedUp}
                  variant="primary"
                  size="sm"
                  loading={move.isPending}
                  onPress={() =>
                    move.mutate({ orderId: d.order_id, status: "picked_up" })
                  }
                />
              ) : null}
              {d.provider === "own" && d.status === "picked_up" ? (
                <Button
                  title={t.ordering.markDelivered}
                  variant="success"
                  size="sm"
                  loading={move.isPending}
                  onPress={() =>
                    move.mutate({ orderId: d.order_id, status: "delivered" })
                  }
                />
              ) : null}
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  backText: { fontSize: typography.sizes.md, color: colors.foreground },
  availRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  availText: { fontSize: typography.sizes.md, color: colors.foreground },
  list: { padding: spacing.xl, gap: spacing.md },
  empty: {
    textAlign: "center",
    color: colors.muted,
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: 4,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between" },
  number: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  status: { fontSize: 13, color: colors.primary, fontWeight: "600" },
  name: { fontSize: typography.sizes.md, color: colors.foreground },
  addr: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  muted: { fontSize: 13, color: colors.muted },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
