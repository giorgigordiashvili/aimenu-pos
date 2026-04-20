import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { login as loginRequest, logout as logoutRequest } from '@/api/auth';
import { tokenStore } from '@/api/client';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await tokenStore.get();
      setIsAuthenticated(!!token);
      setIsLoading(false);
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await loginRequest(email, password);
    setIsAuthenticated(true);
  }, []);

  const signOut = useCallback(async () => {
    await logoutRequest();
    setIsAuthenticated(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ isAuthenticated, isLoading, signIn, signOut }),
    [isAuthenticated, isLoading, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
