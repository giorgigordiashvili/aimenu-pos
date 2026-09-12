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
  | "payments";

export interface MyRestaurantInfo extends Omit<
  MyRestaurant,
  "venue" | "logo" | "modules"
> {
  logo: string | null;
  venue: { slug: string; name: string } | null;
  /** Which product areas the restaurant has switched on (Settings -> Modules). */
  modules: Partial<Record<ModuleCode, boolean>>;
}

export function moduleOn(
  r: MyRestaurantInfo | null | undefined,
  code: ModuleCode,
): boolean {
  // Missing key (older backend) counts as on, except for opt-in modules.
  const value = r?.modules?.[code];
  if (value === undefined) return code !== "warehouse" && code !== "payments";
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
