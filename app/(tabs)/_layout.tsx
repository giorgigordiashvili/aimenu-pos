import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Tabs, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

import { listKitchenOrders, resolveOrderStatus } from "@/api/orders";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/i18n";
import {
  TAB_HREF,
  TAB_ORDER,
  tabsForRestaurant,
  type TabName,
} from "@/lib/roleTabs";
import { colors, typography } from "@/theme/tokens";

const ICONS: Record<TabName, keyof typeof Ionicons.glyphMap> = {
  reservations: "calendar",
  orders: "receipt",
  tables: "grid-outline",
  kitchen: "flame",
  settings: "settings",
};

export default function TabsLayout() {
  const t = useT();
  const { currentRestaurant, restaurantsLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Which tabs this membership may use (settings only until we know the role).
  const visible = tabsForRestaurant(
    restaurantsLoaded ? currentRestaurant : undefined,
  );
  const canSeeKitchen = visible.includes("kitchen");

  // Badge = tickets waiting for the kitchen to accept. Same key as the kitchen
  // screen, so it never double-fetches while that screen is open.
  const kitchen = useQuery({
    queryKey: ["kitchen-board"],
    queryFn: () => listKitchenOrders({ pageSize: 100 }),
    enabled: canSeeKitchen,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    notifyOnChangeProps: ["data"],
  });
  const newCount =
    kitchen.data?.results.filter(
      (r) => resolveOrderStatus(r.status) === "confirmed",
    ).length ?? 0;

  // A deep link, reload or role change can leave the user on a hidden tab.
  useEffect(() => {
    const current = (segments as string[])[1] as TabName | undefined;
    if (
      restaurantsLoaded &&
      current &&
      TAB_ORDER.includes(current) &&
      !visible.includes(current)
    ) {
      router.replace(TAB_HREF[visible[0]]);
    }
  }, [restaurantsLoaded, visible, segments, router]);

  const titles: Record<TabName, string> = {
    reservations: t.nav.reservations,
    orders: t.nav.orders,
    tables: t.nav.tables,
    kitchen: t.nav.kitchen,
    settings: t.nav.settings,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.slate500,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderSoft,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.semibold,
        },
      }}
    >
      {TAB_ORDER.map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: titles[name],
            href: visible.includes(name) ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={ICONS[name]} color={color} size={size} />
            ),
            ...(name === "kitchen" && newCount > 0
              ? {
                  tabBarBadge: newCount,
                  tabBarBadgeStyle: { backgroundColor: colors.primary },
                }
              : {}),
          }}
        />
      ))}
    </Tabs>
  );
}
