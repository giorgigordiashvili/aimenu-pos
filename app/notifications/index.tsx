import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  listNotifications,
  markRead,
  type NotificationRow,
} from "@/api/notifications";
import TopBar from "@/components/TopBar";
import { useLocale } from "@/i18n";
import { routeForNotification } from "@/lib/pushRegistration";
import { colors, radius, spacing, typography } from "@/theme/tokens";

function timeAgo(iso: string, t: { minutesAgo: string; hoursAgo: string }) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.round(diff / 60_000);
  if (min < 60) return t.minutesAgo.replace("{n}", String(min));
  const h = Math.round(min / 60);
  if (h < 24) return t.hoursAgo.replace("{n}", String(h));
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsScreen() {
  const { t } = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(),
    refetchInterval: 30_000,
  });
  const rows = query.data?.results ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["notifications-unread"] });
  };

  const open = async (n: NotificationRow) => {
    if (!n.read_at) {
      await markRead([n.id]).catch(() => {});
      invalidate();
    }
    const path = routeForNotification(n.data ?? {});
    if (path && path !== "/notifications") router.push(path as Href);
  };

  const readAll = async () => {
    await markRead().catch(() => {});
    invalidate();
  };

  return (
    <SafeAreaView style={styles.root}>
      <TopBar title={t.notifications.title} />
      <View style={styles.actions}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={18} color={colors.foreground} />
          <Text style={styles.backText}>{t.common.close}</Text>
        </Pressable>
        <Pressable onPress={readAll} style={styles.readAll} testID="read-all">
          <Text style={styles.readAllText}>{t.notifications.markAllRead}</Text>
        </Pressable>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {query.isLoading ? "…" : t.notifications.empty}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => open(item)}
            style={[styles.row, !item.read_at && styles.rowUnread]}
            testID={`notification-${item.id}`}
          >
            <View style={[styles.dot, !item.read_at && styles.dotUnread]} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.title}>{item.title}</Text>
              {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
              <Text style={styles.meta}>
                {timeAgo(item.created_at, t.notifications)}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.slate400}
            />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  back: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { fontSize: typography.sizes.md, color: colors.foreground },
  readAll: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  readAllText: { fontSize: 13, fontWeight: "600", color: colors.foreground },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: 8 },
  empty: {
    textAlign: "center",
    color: colors.muted,
    marginTop: spacing.xl,
    fontSize: typography.sizes.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  rowUnread: { borderColor: colors.primary },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  dotUnread: { backgroundColor: colors.primary },
  title: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  body: { fontSize: 13, color: colors.muted },
  meta: { fontSize: 12, color: colors.slate500 },
});
