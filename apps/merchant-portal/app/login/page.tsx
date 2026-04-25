"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { flushSync } from "react-dom";
import { ActionButton, BrandMark, SurfaceCard } from "@sexxymarket/ui";
import { LockKeyhole, ShieldCheck, Store } from "lucide-react";
import { ThemeToggle } from "../../components/theme-toggle";
import { PasswordField } from "../../components/password-field";
import { MERCHANT_NAME_KEY, MERCHANT_TOKEN_COOKIE, MERCHANT_TOKEN_KEY } from "../../lib/merchant-auth";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function formatLoginErrorMessage(status: number, body: unknown): string {
  if (status === 401 || status === 403) return "Unable to sign in. Check your email and password.";
  if (typeof body === "object" && body && "message" in body) {
    const raw = (body as { message: unknown }).message;
    if (typeof raw === "string" && raw.trim()) return raw;
    if (Array.isArray(raw) && raw.length) return raw.map(String).join(" ");
  }
  if (status >= 500) return "Server error while signing in. Please try again shortly.";
  return "Unable to sign in. Please try again.";
}

export default function MerchantLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetStep, setResetStep] = useState<"request" | "confirm">("request");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  const submit = async () => {
    if (!email.trim() || !password.trim()) {
      setMessage("Enter your email and password.");
      return;
    }
    flushSync(() => {
      setSubmitting(true);
    });
    setMessage("");
    setShowResendVerification(false);
    setVerificationToken("");
    try {
      const response = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        let body: unknown = null;
        try {
          body = await response.json();
        } catch {
          body = null;
        }
        setMessage(formatLoginErrorMessage(response.status, body));
        return;
      }
      const payload = (await response.json()) as {
        accessToken: string;
        user: { role: string; emailVerified?: boolean; mustChangePassword?: boolean };
      };
      if (payload.user.role === "ADMIN" || payload.user.role === "SUPER_ADMIN") {
        setMessage("Admin accounts cannot be used in the merchant portal.");
        return;
      }
      if (!payload.user.mustChangePassword && !payload.user.emailVerified) {
        setVerificationToken(payload.accessToken);
        setShowResendVerification(true);
        setMessage(
          "Your email is not verified yet. Open the verification link from your inbox, then sign in again.",
        );
        return;
      }
      localStorage.setItem(MERCHANT_TOKEN_KEY, payload.accessToken);
      document.cookie = `${MERCHANT_TOKEN_COOKIE}=${encodeURIComponent(payload.accessToken)}; Path=/; SameSite=Lax`;
      localStorage.setItem(MERCHANT_NAME_KEY, email.split("@")[0]);
      router.push("/dashboard");
    } catch {
      setMessage("Network error. Confirm API availability and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resendVerification = async () => {
    if (!verificationToken) {
      setMessage("Please sign in again before resending verification.");
      return;
    }
    flushSync(() => {
      setResending(true);
    });
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/api/auth/resend-verification`, {
        method: "POST",
        headers: { Authorization: `Bearer ${verificationToken}` },
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
      if (!response.ok) {
        const msg = Array.isArray(body.message) ? body.message[0] : body.message;
        setMessage(typeof msg === "string" ? msg : "Could not resend verification email.");
        return;
      }
      const msg = Array.isArray(body.message) ? body.message[0] : body.message;
      setMessage(typeof msg === "string" ? msg : "Verification email resent.");
    } catch {
      setMessage("Could not resend verification email right now.");
    } finally {
      setResending(false);
    }
  };

  const requestPasswordReset = async () => {
    if (!email.trim()) {
      setResetMessage("Enter your email first.");
      return;
    }
    flushSync(() => {
      setResetSubmitting(true);
    });
    setResetMessage("");
    try {
      const response = await fetch(`${apiBase}/api/auth/password-reset/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
      const msg = Array.isArray(body.message) ? body.message[0] : body.message;
      setResetMessage(typeof msg === "string" ? msg : "If this email exists, a reset code was sent.");
      if (response.ok) setResetStep("confirm");
    } catch {
      setResetMessage("Unable to request reset right now.");
    } finally {
      setResetSubmitting(false);
    }
  };

  const confirmPasswordReset = async () => {
    if (!email.trim() || resetCode.trim().length !== 6 || resetNewPassword.length < 8) {
      setResetMessage("Use a valid email, 6-digit code, and at least 8-character password.");
      return;
    }
    flushSync(() => {
      setResetSubmitting(true);
    });
    setResetMessage("");
    try {
      const response = await fetch(`${apiBase}/api/auth/password-reset/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: resetCode.trim(),
          newPassword: resetNewPassword,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
      const msg = Array.isArray(body.message) ? body.message[0] : body.message;
      if (!response.ok) {
        setResetMessage(typeof msg === "string" ? msg : "Reset failed.");
        return;
      }
      setResetMessage(typeof msg === "string" ? msg : "Password reset successful. Sign in with your new password.");
      setResetOpen(false);
      setResetStep("request");
      setPassword("");
    } catch {
      setResetMessage("Unable to confirm reset right now.");
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <>
      <header className="top-nav">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BrandMark size={38} />
          <strong>Merchant Portal</strong>
        </div>
        <ThemeToggle />
      </header>

      <main className="app-shell" style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div className="merchant-auth-grid">
          <div className="merchant-auth-hero">
            <p className="route-eyebrow" style={{ margin: 0 }}>Seller Operations</p>
            <h1 className="section-title" style={{ margin: "0.2rem 0" }}>Run your storefront like a pro</h1>
            <p className="section-lead">
              Manage product authoring, approvals, verification, and order-facing operations from one focused workspace.
            </p>
            <ul className="merchant-auth-list">
              <li>Super and Standard tier support with clear listing behavior</li>
              <li>KYC verification status and merchant governance controls</li>
              <li>Shared product studio parity with the admin experience</li>
            </ul>
            <p className="muted" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: "0.88rem" }}>
              <ShieldCheck size={16} />
              Keep credentials private and enable email verification before publishing listings.
            </p>
          </div>

          <SurfaceCard style={{ padding: "1.2rem" }}>
            <p className="route-eyebrow">Sign in</p>
            <h2 className="section-title" style={{ fontSize: "1.35rem", margin: "0.1rem 0" }}>Merchant access</h2>
            <p className="section-lead" style={{ fontSize: "0.9rem" }}>
              Sign in to continue merchant onboarding and dashboard access.
            </p>

            <form
              className="route-grid"
              style={{ marginTop: 12, gap: 10 }}
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <div className="field">
                <label htmlFor="merchant-email">Email</label>
                <input
                  id="merchant-email"
                  className="text-input"
                  autoComplete="username"
                  placeholder="owner@business.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="merchant-password">Password</label>
                <PasswordField
                  id="merchant-password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                  placeholder="Enter password"
                />
              </div>

              <div className="actions-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <ActionButton
                  type="submit"
                  disabled={submitting}
                  isLoading={submitting}
                  loadingText="Signing in…"
                >
                  Open dashboard
                </ActionButton>
                <span className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.86rem" }}>
                  <LockKeyhole size={14} />
                  Customer accounts can onboard to merchant after sign-in
                </span>
              </div>
              <div>
                <ActionButton ghost type="button" onClick={() => setResetOpen((v) => !v)}>
                  {resetOpen ? "Close password reset" : "Forgot password?"}
                </ActionButton>
              </div>
            </form>

            {message ? (
              <p role="alert" style={{ color: "var(--ui-danger)", marginTop: 10 }}>
                {message}
              </p>
            ) : null}
            {showResendVerification ? (
              <div style={{ marginTop: 8 }}>
                <ActionButton
                  ghost
                  isLoading={resending}
                  loadingText="Resending…"
                  onClick={() => void resendVerification()}
                  disabled={resending || submitting}
                >
                  Resend verification email
                </ActionButton>
              </div>
            ) : null}
            {resetOpen ? (
              <div className="route-grid" style={{ marginTop: 10, gap: 8 }}>
                <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
                  Reset your password with one-time email OTP.
                </p>
                {resetStep === "confirm" ? (
                  <>
                    <div className="field">
                      <label htmlFor="merchant-reset-code">OTP code</label>
                      <input
                        id="merchant-reset-code"
                        className="text-input"
                        inputMode="numeric"
                        maxLength={6}
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="merchant-reset-password">New password</label>
                      <PasswordField
                        id="merchant-reset-password"
                        value={resetNewPassword}
                        onChange={setResetNewPassword}
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        containerClassName=""
                      />
                    </div>
                  </>
                ) : null}
                <div className="actions-row">
                  {resetStep === "request" ? (
                    <ActionButton
                      type="button"
                      isLoading={resetSubmitting}
                      loadingText="Sending…"
                      onClick={() => void requestPasswordReset()}
                      disabled={resetSubmitting}
                    >
                      Send reset code
                    </ActionButton>
                  ) : (
                    <>
                      <ActionButton
                        type="button"
                        isLoading={resetSubmitting}
                        loadingText="Resetting…"
                        onClick={() => void confirmPasswordReset()}
                        disabled={resetSubmitting}
                      >
                        Reset password
                      </ActionButton>
                      <ActionButton ghost type="button" onClick={() => setResetStep("request")} disabled={resetSubmitting}>
                        Back
                      </ActionButton>
                    </>
                  )}
                </div>
                {resetMessage ? <p className="muted" style={{ margin: 0 }}>{resetMessage}</p> : null}
              </div>
            ) : null}

            <div className="merchant-auth-footer">
              <p className="muted" style={{ margin: 0 }}>
                New merchant? <Link href="/register" className="subtle-link">Create merchant account</Link>
              </p>
              <p className="muted" style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Store size={14} />
                Registration includes email verification and merchant onboarding.
              </p>
            </div>
          </SurfaceCard>
        </div>
      </main>
    </>
  );
}


