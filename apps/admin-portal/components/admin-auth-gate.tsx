"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearAdminSession, getStoredAdminToken } from "../lib/admin-auth";
import { getAdminApiBase } from "../lib/admin-api";
import { PageSectionSkeleton } from "./loading-primitives";

export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getStoredAdminToken();
    if (!token) {
      clearAdminSession();
      router.replace("/login");
      return;
    }
    const apiBase = getAdminApiBase();
    void fetch(`${apiBase}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) {
          clearAdminSession();
          router.replace("/login");
          return;
        }
        const me = (await response.json()) as { role?: string };
        if (!me.role || !["ADMIN", "SUPER_ADMIN"].includes(me.role)) {
          clearAdminSession();
          router.replace("/login");
          return;
        }
        setReady(true);
      })
      .catch(() => {
        clearAdminSession();
        router.replace("/login");
      });
  }, [router]);

  if (!ready) {
    return (
      <main className="app-shell route-grid" style={{ paddingTop: "0.5rem" }} aria-busy="true" aria-live="polite">
        <PageSectionSkeleton />
        <p className="muted" role="status" style={{ margin: 0 }}>
          Verifying secure session...
        </p>
      </main>
    );
  }
  return <>{children}</>;
}
