import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { unregisterPush } from "@/lib/pushRegistration";
import { login as loginRequest, logout as logoutRequest } from "@/api/auth";
import { restaurantStore, tokenStore } from "@/api/client";
import { listMyRestaurants, type MyRestaurantInfo } from "@/api/restaurants";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  restaurantSlug: string | null;
  /** Restaurants this user may work in; empty until loaded. */
  restaurants: MyRestaurantInfo[];
  restaurantsLoaded: boolean;
  currentRestaurant: MyRestaurantInfo | null;
  /** Logs in, then loads the user's restaurants. Auto-selects when there is exactly one. */
  signIn: (
    email: string,
    password: string,
  ) => Promise<{
    selected: string | null;
    restaurant: MyRestaurantInfo | null;
  }>;
  signOut: () => Promise<void>;
  /** Switch the active restaurant (X-Restaurant header). Callers invalidate queries. */
  setRestaurantSlug: (slug: string) => Promise<void>;
  refreshRestaurants: () => Promise<MyRestaurantInfo[]>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [restaurantSlug, setRestaurantSlugState] = useState<string | null>(
    null,
  );
  const [restaurants, setRestaurants] = useState<MyRestaurantInfo[]>([]);
  const [restaurantsLoaded, setRestaurantsLoaded] = useState(false);

  const refreshRestaurants = useCallback(async () => {
    try {
      const rows = await listMyRestaurants();
      setRestaurants(rows);
      return rows;
    } catch {
      return [];
    } finally {
      setRestaurantsLoaded(true);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const [token, slug] = await Promise.all([
        tokenStore.get(),
        restaurantStore.get(),
      ]);
      setIsAuthenticated(!!token);
      setRestaurantSlugState(slug);
      setIsLoading(false);
      if (token) refreshRestaurants();
    })();
  }, [refreshRestaurants]);

  const setRestaurantSlug = useCallback(async (slug: string) => {
    const normalised = slug.trim().toLowerCase();
    await restaurantStore.set(normalised);
    setRestaurantSlugState(normalised);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await loginRequest(email, password);
      setIsAuthenticated(true);
      const rows = await refreshRestaurants();
      // One restaurant: no need to ask. Several (e.g. a restaurant plus the
      // shared bar next to it): the picker screen takes over.
      let selected: string | null = null;
      if (rows.length === 1) {
        selected = rows[0].slug;
      } else if (rows.length > 1) {
        const previous = await restaurantStore.get();
        selected = rows.some((r) => r.slug === previous) ? previous : null;
      }
      if (selected) {
        await setRestaurantSlug(selected);
      } else {
        await restaurantStore.clear();
        setRestaurantSlugState(null);
      }
      return {
        selected,
        restaurant: rows.find((r) => r.slug === selected) ?? null,
      };
    },
    [refreshRestaurants, setRestaurantSlug],
  );

  const signOut = useCallback(async () => {
    await unregisterPush();
    await logoutRequest();
    setIsAuthenticated(false);
    setRestaurantSlugState(null);
    setRestaurants([]);
    setRestaurantsLoaded(false);
  }, []);

  const currentRestaurant = useMemo(
    () => restaurants.find((r) => r.slug === restaurantSlug) ?? null,
    [restaurants, restaurantSlug],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      isLoading,
      restaurantSlug,
      restaurants,
      restaurantsLoaded,
      currentRestaurant,
      signIn,
      signOut,
      setRestaurantSlug,
      refreshRestaurants,
    }),
    [
      isAuthenticated,
      isLoading,
      restaurantSlug,
      restaurants,
      restaurantsLoaded,
      currentRestaurant,
      signIn,
      signOut,
      setRestaurantSlug,
      refreshRestaurants,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
