import type { Href } from "expo-router";

import type { MyRestaurantInfo } from "@/api/restaurants";

export type TabName =
  | "reservations"
  | "orders"
  | "tables"
  | "kitchen"
  | "settings";

/** Render order in the tab bar; `_layout.tsx` iterates this so ordering is explicit. */
export const TAB_ORDER: TabName[] = [
  "reservations",
  "orders",
  "tables",
  "kitchen",
  "settings",
];

export const TAB_HREF: Record<TabName, Href> = {
  reservations: "/(tabs)/reservations",
  orders: "/(tabs)/orders",
  tables: "/(tabs)/tables",
  kitchen: "/(tabs)/kitchen",
  settings: "/(tabs)/settings",
};

const MANAGER: TabName[] = [
  "reservations",
  "orders",
  "tables",
  "kitchen",
  "settings",
];
const WAITER: TabName[] = ["reservations", "orders", "tables", "settings"];
const KITCHEN: TabName[] = ["kitchen", "settings"];
const MINIMAL: TabName[] = ["settings"];

/**
 * Which tabs a membership may see. The backend's role permissions are the
 * real gate; this only keeps screens a role cannot use out of the way.
 *
 * `undefined` = memberships not loaded yet → settings only, so a tab the user
 * must not see never flashes. `null` = a slug typed by hand that is not among
 * the memberships → everything (legacy owners), the API will 403 what it must.
 */
export function tabsForRestaurant(
  r: MyRestaurantInfo | null | undefined,
): TabName[] {
  if (r === undefined) return MINIMAL;
  if (r === null || r.is_owner) return MANAGER;
  switch (r.role) {
    case "owner":
    case "manager":
      return MANAGER;
    case "waiter":
      return WAITER;
    case "kitchen":
    case "bar":
      return KITCHEN;
    default:
      return MINIMAL; // warehouse_manager, custom, staff
  }
}

export function firstTabFor(r: MyRestaurantInfo | null | undefined): Href {
  return TAB_HREF[tabsForRestaurant(r)[0]];
}
