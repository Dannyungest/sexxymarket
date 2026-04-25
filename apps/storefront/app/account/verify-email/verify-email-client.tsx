"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ActionButton, SurfaceCard } from "@sexxymarket/ui";
import { StorefrontShell } from "../../../components/storefront-shell";
import { verifyEmail } from "../../../lib/storefront-api";

const ACCESS_TOKEN_KEY = "sm_access_token";

export function VerifyEmailClient() {
  const params = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState("Confirming your email…");
  const [kind, setKind] = useState<"success" | "error">("success");
  const [done, setDone] = useState(false);
  const token = params.get("token");

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const result = await verifyEmail(token);
        localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
        setKind("success");
        setMessage("Your email is verified. You can place orders and use your full account.");
        setDone(true);
      } catch {
        setKind("error");
        setMessage(
          "This link is invalid or expired. Sign in and request a new confirmation email from your account page.",
        );
      }
    })();
  }, [token]);

  return (
    <StorefrontShell>
      <section className="auth-wrap">
        <SurfaceCard className="auth-card" style={{ maxWidth: 560, margin: "3rem auto" }}>
          <h1 className="section-title">Email verification</h1>
          <p className={`status-note ${!token || kind === "error" ? "error" : "success"}`} role="status">
            {token ? message : "Missing verification token. Open the link from your email."}
          </p>
          {token && kind === "success" && done ? (
            <div className="auth-actions" style={{ marginTop: 16 }}>
              <ActionButton onClick={() => router.push("/checkout")}>Continue to checkout</ActionButton>
            </div>
          ) : null}
          <p className="auth-meta" style={{ marginTop: 12 }}>
            <Link href="/account">Back to account</Link>
          </p>
        </SurfaceCard>
      </section>
    </StorefrontShell>
  );
}
