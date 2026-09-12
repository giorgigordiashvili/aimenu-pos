import { useQuery } from "@tanstack/react-query";

import { listPlatforms } from "@/api/delivery";
import { can, moduleOn } from "@/api/restaurants";
import { useAuth } from "@/context/AuthContext";

/** Delivery platforms (Glovo / Wolt) with their live pause state; polled once a minute. */
export function useDeliveryPlatforms() {
  const { currentRestaurant, restaurantsLoaded } = useAuth();
  const enabled = restaurantsLoaded && moduleOn(currentRestaurant, "delivery");
  const query = useQuery({
    queryKey: ["delivery-platforms"],
    queryFn: listPlatforms,
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const rows = (query.data ?? []).filter((r) => r.implemented && r.is_enabled);
  return {
    enabled,
    platforms: rows,
    canPause: can(currentRestaurant, "orders", "update"),
    canSyncMenu: can(currentRestaurant, "settings", "update"),
    refetch: query.refetch,
  };
}
