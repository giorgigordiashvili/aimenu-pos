import { useQuery } from "@tanstack/react-query";

import { getCurrentShift } from "@/api/payments";
import { can, moduleOn } from "@/api/restaurants";
import { useAuth } from "@/context/AuthContext";

/**
 * The restaurant's open cash shift (or null). Only polls when the Cash
 * module is on and the user may read it; otherwise `enabled` is false and
 * screens hide everything shift-related.
 */
export function useShift() {
  const { currentRestaurant, restaurantsLoaded } = useAuth();
  const enabled =
    restaurantsLoaded &&
    moduleOn(currentRestaurant, "cash") &&
    can(currentRestaurant, "cash", "read");
  const query = useQuery({
    queryKey: ["cash-shift"],
    queryFn: getCurrentShift,
    enabled,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  return {
    enabled,
    shift: query.data ?? null,
    isLoading: enabled && query.isLoading,
    refetch: query.refetch,
    canOpen: can(currentRestaurant, "cash", "create"),
    canClose: can(currentRestaurant, "cash", "update"),
    canPay: enabled && can(currentRestaurant, "cash", "create"),
    canDiscount: enabled && can(currentRestaurant, "cash", "update"),
    canRefund: enabled && can(currentRestaurant, "cash", "delete"),
  };
}
