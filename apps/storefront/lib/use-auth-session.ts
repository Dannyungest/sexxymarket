"use client";

import { useCallback, useEffect, useState } from "react";
import { getMe } from "./storefront-api";

const ACCESS_TOKEN_KEY = "sm_access_token";

export type AuthSession = {
  token: string;
  email: string;
  emailVerified: boolean;
  mustChangePassword: boolean;
  firstName: string;
  lastName: string;
  phone: string | null;
};

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function useAuthSession() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    const t = getStoredToken();
    if (!t) {
      setSession(null);
      setLoading(false);
      return;
    }
    void getMe(t)
      .then((u) => {
        setSession({
          token: t,
          email: u.email,
          emailVerified: u.emailVerified ?? false,
          mustChangePassword: u.mustChangePassword ?? false,
          firstName: u.firstName,
          lastName: u.lastName,
          phone: u.phone ?? null,
        });
      })
      .catch(() => {
        try {
          localStorage.removeItem(ACCESS_TOKEN_KEY);
        } catch {
          /* no-op */
        }
        setSession(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  return { loading, session, refresh, ACCESS_TOKEN_KEY } as const;
}
