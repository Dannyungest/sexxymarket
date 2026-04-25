"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { ActionButton, BrandMark, SurfaceCard } from "@sexxymarket/ui";
import { Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "../../components/theme-toggle";
import { ADMIN_TOKEN_COOKIE, persistAdminSession } from "../../lib/admin-auth";
import { PasswordField } from "../../components/password-field";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function formatLoginErrorMessage(status: number, body: unknown): string {
  if (typeof body === "object" && body !== null && "message" in body) {
    const raw = (body as { message: unknown }).message;
    if (typeof raw === "string" && raw.trim()) return raw;
    if (Array.isArray(raw) && raw.length) return raw.map(String).join(" ");
  }
  if (status === 401 || status === 403) {
    return "Unable to login. Check credentials.";
  }
  if (status >= 500) {
    return "Server error while signing in. If this persists, confirm the API has JWT_ACCESS_SECRET set and restart the API.";
  }
  return "Unable to login. Try again or contact support.";
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetStep, setResetStep] = useState<"request" | "confirm">("request");
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  const submitCredentials = async () => {
    if (!email.trim() || !password.trim()) {
      setMessage("Enter your work email and password.");
      return;
    }
    flushSync(() => {
      setSubmitting(true);
    });
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/api/auth/admin/login/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, keepSignedIn }),
      });
      if (!response.ok) {
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          body = null;
        }
        setMessage(formatLoginErrorMessage(response.status, body));
        return;
      }
      const payload = (await response.json()) as { challengeId: string; expiresAt: string };
      setChallengeId(payload.challengeId);
      setExpiresAt(payload.expiresAt);
      setStep("otp");
      setMessage("A one-time code was sent to your email.");
    } catch {
      setMessage("Network error. Confirm the API is running and NEXT_PUBLIC_API_BASE_URL is correct.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitOtp = async () => {
    flushSync(() => {
      setSubmitting(true);
    });
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/api/auth/admin/login/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code: otpCode.trim(), keepSignedIn }),
      });
      if (!response.ok) {
        let body: unknown;
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
        refreshToken?: string;
        user: { role: string };
      };
      if (!["ADMIN", "SUPER_ADMIN"].includes(payload.user.role)) {
        setMessage("Access denied. Admin role required.");
        return;
      }
      persistAdminSession({
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        keepSignedIn,
      });
      const cookieMaxAge = keepSignedIn ? 60 * 60 * 24 * 30 : undefined;
      document.cookie = `${ADMIN_TOKEN_COOKIE}=${encodeURIComponent(payload.accessToken)}; Path=/; SameSite=Lax${
        cookieMaxAge ? `; Max-Age=${cookieMaxAge}` : ""
      }`;
      router.push("/dashboard");
    } catch {
      setMessage("Network error while verifying code.");
    } finally {
      setSubmitting(false);
    }
  };

  const resendOtp = async () => {
    if (!challengeId) return;
    flushSync(() => {
      setSubmitting(true);
    });
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/api/auth/admin/login/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId }),
      });
      if (!response.ok) {
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          body = null;
        }
        setMessage(formatLoginErrorMessage(response.status, body));
        return;
      }
      const payload = (await response.json()) as { challengeId: string; expiresAt: string };
      setChallengeId(payload.challengeId);
      setExpiresAt(payload.expiresAt);
      setOtpCode("");
      setMessage("A fresh verification code has been sent.");
    } catch {
      setMessage("Network error while resending code.");
    } finally {
      setSubmitting(false);
    }
  };

  const requestPasswordReset = async () => {
    if (!resetEmail.trim()) {
      setResetMessage("Enter your account email.");
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
        body: JSON.stringify({ email: resetEmail.trim() }),
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
    if (!resetEmail.trim() || resetCode.trim().length !== 6 || resetNewPassword.length < 8) {
      setResetMessage("Use a valid email, 6-digit code, and a password of at least 8 characters.");
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
          email: resetEmail.trim(),
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
      setResetMessage(typeof msg === "string" ? msg : "Password reset successful. You can now sign in.");
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
          <strong>Admin Portal</strong>
        </div>
        <ThemeToggle />
      </header>
      <main className="app-shell" style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div className="admin-login-grid">
          <div className="admin-login-hero" aria-hidden={false}>
            <p className="route-eyebrow" style={{ margin: 0 }}>
              Operations
            </p>
            <h1 className="section-title" style={{ margin: "0.2rem 0" }}>
              Premium staff console
            </h1>
            <p className="section-lead">
              A calm, high-trust control surface for orders, catalog governance, and merchant lifecycle—aligned with the
              public Sexxy Market experience.
            </p>
            <ul style={{ color: "var(--ui-muted)", lineHeight: 1.6, fontSize: "0.95rem" }}>
              <li>Session-based access with full audit support</li>
              <li>Role separation between admin and super admin</li>
              <li>Never share credentials; use a password manager</li>
            </ul>
            <p
              className="muted"
              style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: "0.88rem" }}
            >
              <ShieldCheck size={16} />
              Use credentials your organization issued—never a shared password in public channels.
            </p>
          </div>
          <div style={{ position: "relative" }}>
          <SurfaceCard style={{ padding: "1.2rem" }}>
            <p className="route-eyebrow">Sign in</p>
            <h2 className="section-title" style={{ fontSize: "1.35rem", margin: "0.1rem 0" }}>
              Secure access
            </h2>
            <p className="section-lead" style={{ fontSize: "0.9rem" }}>
              Restricted to admin roles on this deployment.
            </p>
            <form
              className="route-grid"
              style={{ marginTop: 12, gap: 10 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (step === "credentials") {
                  void submitCredentials();
                } else {
                  void submitOtp();
                }
              }}
            >
              {step === "credentials" ? (
                <>
                  <div className="field">
                    <label htmlFor="admin-email">Work email</label>
                    <input
                      id="admin-email"
                      className="text-input"
                      autoComplete="username"
                      placeholder="ops@…"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="admin-password">Password</label>
                    <PasswordField
                      id="admin-password"
                      value={password}
                      onChange={setPassword}
                      autoComplete="current-password"
                      placeholder="Enter password"
                      containerClassName=""
                    />
                  </div>
                  <label className="chip" style={{ display: "inline-flex", gap: 8, alignItems: "center", width: "fit-content" }}>
                    <input
                      type="checkbox"
                      checked={keepSignedIn}
                      onChange={(event) => setKeepSignedIn(event.target.checked)}
                    />
                    Keep me signed in on this device
                  </label>
                </>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="admin-otp-code">Email verification code</label>
                    <input
                      id="admin-otp-code"
                      className="text-input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="6-digit code"
                      maxLength={6}
                      value={otpCode}
                      onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                  </div>
                  <p className="muted" style={{ margin: 0, fontSize: "0.86rem" }}>
                    Code expires: {expiresAt ? new Date(expiresAt).toLocaleString() : "soon"}.
                  </p>
                </>
              )}
              <div className="actions-row" style={{ flexWrap: "wrap" }}>
                <ActionButton
                  type="submit"
                  isLoading={submitting}
                  loadingText={step === "credentials" ? "Authenticating…" : "Verifying…"}
                  disabled={
                    submitting ||
                    (step === "credentials" ? false : otpCode.trim().length !== 6)
                  }
                >
                  {step === "credentials" ? "Continue to verification" : "Enter dashboard"}
                </ActionButton>
                {step === "otp" ? (
                  <>
                    <ActionButton
                      ghost
                      type="button"
                      isLoading={submitting}
                      loadingText="Resending…"
                      onClick={() => void resendOtp()}
                      disabled={submitting}
                    >
                      Resend code
                    </ActionButton>
                    <ActionButton
                      ghost
                      type="button"
                      onClick={() => {
                        setStep("credentials");
                        setOtpCode("");
                        setChallengeId("");
                        setExpiresAt("");
                        setMessage("");
                      }}
                      disabled={submitting}
                    >
                      Back
                    </ActionButton>
                  </>
                ) : null}
                <span className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.86rem" }}>
                  <LockKeyhole size={14} />
                  Fresh logins require email verification code
                </span>
              </div>
              {step === "credentials" ? (
                <div>
                  <ActionButton ghost type="button" onClick={() => setResetOpen((v) => !v)}>
                    {resetOpen ? "Close password reset" : "Forgot password?"}
                  </ActionButton>
                </div>
              ) : null}
            </form>
            {resetOpen ? (
              <div className="route-grid" style={{ marginTop: 12, gap: 8 }}>
                <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
                  Reset with a one-time email code.
                </p>
                <div className="field">
                  <label htmlFor="reset-email">Email</label>
                  <input
                    id="reset-email"
                    className="text-input"
                    value={resetEmail}
                    onChange={(event) => setResetEmail(event.target.value)}
                    autoComplete="email"
                  />
                </div>
                {resetStep === "confirm" ? (
                  <>
                    <div className="field">
                      <label htmlFor="reset-code">OTP code</label>
                      <input
                        id="reset-code"
                        className="text-input"
                        value={resetCode}
                        onChange={(event) => setResetCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        inputMode="numeric"
                        maxLength={6}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="reset-password">New password</label>
                      <PasswordField
                        id="reset-password"
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
                {resetMessage ? <p style={{ color: "var(--ui-muted)", margin: 0 }}>{resetMessage}</p> : null}
              </div>
            ) : null}
            {message ? (
              <p style={{ color: "var(--ui-danger)", marginTop: 10 }} role="alert">
                {message}
              </p>
            ) : null}
          </SurfaceCard>
          {submitting && step === "otp" ? (
            <div
              className="loading-region"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                zIndex: 2,
                borderRadius: 14,
                background: "color-mix(in srgb, var(--ui-raised) 80%, transparent)",
                backdropFilter: "blur(4px)",
                pointerEvents: "none",
              }}
              aria-hidden
            >
              <Loader2
                size={32}
                strokeWidth={1.6}
                style={{ animation: "spinner 0.8s linear infinite" }}
                className="auth-otp-loader"
              />
              <p style={{ margin: 0, fontSize: "0.92rem", color: "var(--ui-fg)" }}>Verifying your one-time code…</p>
              <style>{"@keyframes spinner { to { transform: rotate(360deg); } }"}</style>
            </div>
          ) : null}
          </div>
        </div>
      </main>
    </>
  );
}
