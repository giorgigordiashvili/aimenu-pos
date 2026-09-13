import { usersMeRestaurantsList } from "@/api/generated/api";
import type { MyRestaurant } from "@/api/generated/interfaces";

/** `venue` is nested `{slug, name} | null` on the wire; the generator flattens it to Record. */
export type ModuleCode =
  | "menu"
  | "ordering"
  | "tables"
  | "reservations"
  | "kitchen"
  | "warehouse"
  | "loyalty"
  | "reviews"
  | "cash"
  | "printing"
  | "fiscal"
  | "delivery"
  | "notifications"
  | "promotions"
  | "purchasing"
  | "timekeeping"
  | "crm"
  | "online_ordering"
  | "terminals"
  | "waitlist"
  | "payments";

export type Resource =
  | "menu"
  | "orders"
  | "tables"
  | "reservations"
  | "warehouse"
  | "warehouse_logs"
  | "cash"
  | "staff"
  | "settings"
  | "analytics";
export type Action = "create" | "read" | "update" | "delete";

export interface MyRestaurantInfo extends Omit<
  MyRestaurant,
  "venue" | "logo" | "modules" | "permissions"
> {
  logo: string | null;
  venue: { slug: string; name: string } | null;
  /** Which product areas the restaurant has switched on (Settings -> Modules). */
  modules: Partial<Record<ModuleCode, boolean>>;
  /** Effective role permissions of the signed-in user at this restaurant. */
  permissions?: Partial<Record<Resource, string[]>>;
}

/**
 * May the signed-in user do `action` on `resource` here? Owners may do
 * anything; an unknown restaurant (typed slug) is optimistic, the API 403s.
 */
export function can(
  r: MyRestaurantInfo | null | undefined,
  resource: Resource,
  action: Action,
): boolean {
  if (!r) return true;
  if (r.is_owner) return true;
  const allowed = r.permissions?.[resource];
  if (!allowed) return false;
  return allowed.includes(action) || allowed.includes("*");
}

export function moduleOn(
  r: MyRestaurantInfo | null | undefined,
  code: ModuleCode,
): boolean {
  // Missing key (older backend) counts as on, except for opt-in modules.
  const value = r?.modules?.[code];
  if (value === undefined)
    return (
      code !== "warehouse" &&
      code !== "payments" &&
      code !== "cash" &&
      code !== "printing" &&
      code !== "fiscal"
    );
  return value;
}

/**
 * Restaurants the signed-in user can work in (owned + active staff
 * memberships). The response envelope is unwrapped by the axios interceptor.
 */
export async function listMyRestaurants(): Promise<MyRestaurantInfo[]> {
  const rows =
    (await usersMeRestaurantsList()) as unknown as MyRestaurantInfo[];
  return Array.isArray(rows) ? rows : [];
}
