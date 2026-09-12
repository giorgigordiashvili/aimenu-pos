import type { Href } from "expo-router";

import { moduleOn, type MyRestaurantInfo } from "@/api/restaurants";

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
function tabsForRole(r: MyRestaurantInfo | null): TabName[] {
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

/** A tab also needs its module switched on for the restaurant. */
function tabAllowedByModules(
  r: MyRestaurantInfo | null,
  tab: TabName,
): boolean {
  if (r === null) return true;
  switch (tab) {
    case "reservations":
      return moduleOn(r, "reservations");
    case "tables":
      return moduleOn(r, "tables");
    case "kitchen":
      return moduleOn(r, "kitchen") && moduleOn(r, "ordering");
    default:
      return true; // orders (POS-entered orders are internal) and settings
  }
}

export function tabsForRestaurant(
  r: MyRestaurantInfo | null | undefined,
): TabName[] {
  if (r === undefined) return MINIMAL;
  const tabs = tabsForRole(r).filter((tab) => tabAllowedByModules(r, tab));
  return tabs.length ? tabs : MINIMAL;
}

export function firstTabFor(r: MyRestaurantInfo | null | undefined): Href {
  return TAB_HREF[tabsForRestaurant(r)[0]];
}
