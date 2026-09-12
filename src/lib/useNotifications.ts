import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { unreadCount } from "@/api/notifications";
import { moduleOn } from "@/api/restaurants";
import { useAuth } from "@/context/AuthContext";
import { isAudioUnlocked, playNewTicketChime } from "@/lib/kitchenSound";

/**
 * Unread badge for the TopBar bell. Polls every 15 s; when a newer
 * notification appears than the one we last saw, plays the chime (web needs
 * the audio unlocked by a tap first; native vibrates).
 */
export function useNotifications() {
  const { currentRestaurant, restaurantsLoaded } = useAuth();
  const enabled =
    restaurantsLoaded && moduleOn(currentRestaurant, "notifications");
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: unreadCount,
    enabled,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    notifyOnChangeProps: ["data"],
  });
  const lastSeen = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const latest = query.data?.latest_id ?? null;
    if (lastSeen.current === undefined) {
      lastSeen.current = latest; // first load: no chime for old news
      return;
    }
    if (latest && latest !== lastSeen.current) {
      lastSeen.current = latest;
      if (isAudioUnlocked()) playNewTicketChime();
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
  }, [query.data?.latest_id, qc]);
  return {
    enabled,
    unread: query.data?.unread ?? 0,
    refetch: query.refetch,
  };
}
