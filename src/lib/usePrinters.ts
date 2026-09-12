import { useQuery } from "@tanstack/react-query";

import { bridgePrinters, listPrinters } from "@/api/printing";
import { can, moduleOn } from "@/api/restaurants";
import { useAuth } from "@/context/AuthContext";

/** The restaurant's printers (only polled while the Printing module is on). */
export function usePrinters() {
  const { currentRestaurant, restaurantsLoaded } = useAuth();
  const enabled = restaurantsLoaded && moduleOn(currentRestaurant, "printing");
  const query = useQuery({
    queryKey: ["printers"],
    queryFn: listPrinters,
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const rows = query.data ?? [];
  return {
    enabled,
    printers: rows,
    kitchenPrinters: bridgePrinters(rows, ["kitchen", "bar"]),
    receiptPrinters: bridgePrinters(rows, ["receipt"]),
    canManage: can(currentRestaurant, "settings", "update"),
    refetch: query.refetch,
  };
}
