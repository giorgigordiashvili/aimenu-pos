import { usersMeRestaurantsList } from '@/api/generated/api';
import type { MyRestaurant } from '@/api/generated/interfaces';

/** `venue` is nested `{slug, name} | null` on the wire; the generator flattens it to Record. */
export interface MyRestaurantInfo extends Omit<MyRestaurant, 'venue' | 'logo'> {
  logo: string | null;
  venue: { slug: string; name: string } | null;
}

/**
 * Restaurants the signed-in user can work in (owned + active staff
 * memberships). The response envelope is unwrapped by the axios interceptor.
 */
export async function listMyRestaurants(): Promise<MyRestaurantInfo[]> {
  const rows = (await usersMeRestaurantsList()) as unknown as MyRestaurantInfo[];
  return Array.isArray(rows) ? rows : [];
}
