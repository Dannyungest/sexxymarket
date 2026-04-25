"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ActionButton, SurfaceCard } from "@sexxymarket/ui";
import { MERCHANT_TOKEN_COOKIE, MERCHANT_TOKEN_KEY } from "../../../lib/merchant-auth";

const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");

export function VerifyMerchantEmailClient() {
  const params = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState("Confirming your merchant email...");
  const [kind, setKind] = useState<"success" | "error">("success");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setKind("error");
      setMessage("Missing verification token. Open the link from your email.");
      return;
    }
    void (async () => {
      try {
        const response = await fetch(`${apiBase}/api/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!response.ok) {
          throw new Error("invalid");
        }
        const out = (await response.json()) as { accessToken: string };
        localStorage.setItem(MERCHANT_TOKEN_KEY, out.accessToken);
        document.cookie = `${MERCHANT_TOKEN_COOKIE}=${encodeURIComponent(out.accessToken)}; Path=/; SameSite=Lax`;
        setKind("success");
        setMessage("Merchant email verified. Continue to your dashboard onboarding.");
        setDone(true);
      } catch {
        setKind("error");
        setMessage("This verification link is invalid or expired. Sign in and resend verification email.");
      }
    })();
  }, [params]);

  return (
    <main className="app-shell route-grid" style={{ maxWidth: 620, margin: "2rem auto" }}>
      <SurfaceCard style={{ padding: "1.1rem" }}>
        <h1 className="section-title">Merchant email verification</h1>
        <p style={{ color: kind === "error" ? "var(--ui-danger)" : "var(--ui-success, #16a34a)" }}>{message}</p>
        {kind === "success" && done ? (
          <div className="actions-row">
            <ActionButton onClick={() => router.push("/dashboard")}>Open merchant dashboard</ActionButton>
          </div>
        ) : null}
        <p className="muted" style={{ marginTop: 10 }}>
          <Link href="/login" className="subtle-link">
            Back to merchant login
          </Link>
        </p>
      </SurfaceCard>
    </main>
  );
}
