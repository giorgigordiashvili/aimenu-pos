import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { login as loginRequest, logout as logoutRequest } from '@/api/auth';
import { restaurantStore, tokenStore } from '@/api/client';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  restaurantSlug: string | null;
  signIn: (email: string, password: string, restaurantSlug: string) => Promise<void>;
  signOut: () => Promise<void>;
  setRestaurantSlug: (slug: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [restaurantSlug, setRestaurantSlugState] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [token, slug] = await Promise.all([tokenStore.get(), restaurantStore.get()]);
      setIsAuthenticated(!!token);
      setRestaurantSlugState(slug);
      setIsLoading(false);
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string, slug: string) => {
    await restaurantStore.set(slug.trim().toLowerCase());
    await loginRequest(email, password);
    setRestaurantSlugState(slug.trim().toLowerCase());
    setIsAuthenticated(true);
  }, []);

  const signOut = useCallback(async () => {
    await logoutRequest();
    setIsAuthenticated(false);
    setRestaurantSlugState(null);
  }, []);

  const setRestaurantSlug = useCallback(async (slug: string) => {
    const normalised = slug.trim().toLowerCase();
    await restaurantStore.set(normalised);
    setRestaurantSlugState(normalised);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      isLoading,
      restaurantSlug,
      signIn,
      signOut,
      setRestaurantSlug,
    }),
    [isAuthenticated, isLoading, restaurantSlug, signIn, signOut, setRestaurantSlug]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
