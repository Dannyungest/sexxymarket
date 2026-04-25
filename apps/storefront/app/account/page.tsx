"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { ActionButton, SurfaceCard } from "@sexxymarket/ui";
import { BadgeCheck, Eye, EyeOff, Gift, ShieldCheck, TicketPercent, UserRound, Wallet } from "lucide-react";
import { StorefrontShell } from "../../components/storefront-shell";
import {
  changePassword,
  confirmPasswordReset,
  getMe,
  login,
  register,
  requestPasswordReset,
  resendVerification,
} from "../../lib/storefront-api";
import { safeReturnPath } from "../../lib/safe-return-url";

const ACCESS_TOKEN_KEY = "sm_access_token";

function AccountContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const returnPath = safeReturnPath(
    searchParams.get("returnUrl") ?? searchParams.get("next"),
    "/account",
  );
  const registerRequested = searchParams.get("register") === "1";
  const [mode, setMode] = useState<"login" | "register">(
    registerRequested ? "register" : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error" | "neutral">("neutral");
  const [submitting, setSubmitting] = useState(false);
  /** Session from GET /me — must change password first, then email verify */
  const [hasSession, setHasSession] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [emailVerified, setEmailVerified] = useState(true);
  const [sessionEmail, setSessionEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetStep, setResetStep] = useState<"request" | "confirm">("request");
  const [resetCode, setResetCode] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetMessage, setResetMessage] = useState("");

  const loadSession = async () => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) {
      setHasSession(false);
      return;
    }
    try {
      const me = await getMe(token);
      setHasSession(true);
      setSessionEmail(me.email);
      setMustChangePassword(!!me.mustChangePassword);
      setEmailVerified(!!me.emailVerified);
    } catch {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      setHasSession(false);
    }
  };

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadSession();
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const hasRequiredRegisterFields = mode === "login" || (firstName.trim() && lastName.trim() && phone.trim());
    if (!email.trim() || !password.trim() || !hasRequiredRegisterFields) {
      setMessageKind("error");
      setMessage("Please complete all required fields.");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setMessageKind("error");
      setMessage("Passwords do not match. Please recheck and try again.");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "register") {
        const result = await register({ email, password, firstName, lastName, phone });
        setMessageKind("success");
        setMessage(result.message ?? "Check your email to verify your account before placing orders.");
        return;
      }
      const result = await login({ email, password });
      localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
      setMessageKind("success");
      setHasSession(true);
      setSessionEmail(result.user.email);
      setMustChangePassword(!!result.user.mustChangePassword);
      setEmailVerified(!!result.user.emailVerified);
      if (result.user.mustChangePassword) {
        setMessage("Set a new password to continue, then confirm your email if you have not already.");
        return;
      }
      if (!result.user.emailVerified) {
        setMessage("You are signed in. Please verify your email to place orders—check your inbox or resend below.");
        return;
      }
      if (returnPath !== "/account") {
        router.replace(returnPath);
        return;
      }
      setMessage("Welcome back. Your account is verified and ready.");
    } catch {
      setMessageKind("error");
      setMessage("Authentication failed. Please verify your details and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) return;
    if (newPassword.length < 8 || newPassword !== confirmNewPassword) {
      setMessageKind("error");
      setMessage("New password must be at least 8 characters and match confirmation.");
      return;
    }
    setSubmitting(true);
    try {
      const out = await changePassword(token, { currentPassword, newPassword });
      localStorage.setItem(ACCESS_TOKEN_KEY, out.accessToken);
      setMessageKind("success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setMustChangePassword(!!out.user.mustChangePassword);
      setEmailVerified(!!out.user.emailVerified);
      setMessage(
        out.user.emailVerified
          ? "Password updated. You are all set."
          : "Password updated. Next, verify your email using the link we sent, or resend it below.",
      );
      await loadSession();
    } catch {
      setMessageKind("error");
      setMessage("Could not change password. Check the current (temporary) password.");
    } finally {
      setSubmitting(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    setHasSession(false);
    setMustChangePassword(false);
    setEmailVerified(true);
    setSessionEmail("");
    setMessage("");
  };

  const sendResetCode = async () => {
    if (!email.trim()) {
      setResetMessage("Enter your email first.");
      return;
    }
    setSubmitting(true);
    setResetMessage("");
    try {
      const result = await requestPasswordReset(email.trim());
      setResetMessage(result.message);
      setResetStep("confirm");
    } catch {
      setResetMessage("Could not send reset code right now.");
    } finally {
      setSubmitting(false);
    }
  };

  const applyReset = async () => {
    if (!email.trim() || resetCode.trim().length !== 6 || resetNewPassword.length < 8) {
      setResetMessage("Use valid email, 6-digit code, and minimum 8-character password.");
      return;
    }
    setSubmitting(true);
    setResetMessage("");
    try {
      const result = await confirmPasswordReset({
        email: email.trim(),
        code: resetCode.trim(),
        newPassword: resetNewPassword,
      });
      setResetMessage(result.message);
      setResetOpen(false);
      setResetStep("request");
      setPassword("");
    } catch {
      setResetMessage("Reset failed. Check code and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StorefrontShell>
      <section className="auth-wrap">
        <section className="auth-layout">
          {hasSession && mustChangePassword ? (
            <SurfaceCard className="auth-card" style={{ maxWidth: 480, margin: "0 auto" }}>
              <h1 className="section-title" style={{ marginTop: 0 }}>Set a new password</h1>
              <p className="section-lead">
                {sessionEmail ? <span>Signed in as {sessionEmail}. </span> : null}
                Use your current (or temporary) password, then choose a new one. After this you can verify your email if you have not already.
              </p>
              <form onSubmit={submitChangePassword} className="auth-form">
                <div className="field">
                  <label htmlFor="cur-pw">Current password</label>
                  <input
                    id="cur-pw"
                    className="text-input"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="new-pw">New password</label>
                  <input
                    id="new-pw"
                    className="text-input"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="conf-pw">Confirm new password</label>
                  <input
                    id="conf-pw"
                    className="text-input"
                    type="password"
                    autoComplete="new-password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                  />
                </div>
                <div className="auth-actions">
                  <ActionButton type="submit" disabled={submitting}>
                    {submitting ? "Saving…" : "Update password"}
                  </ActionButton>
                  <button type="button" className="chip" onClick={logout}>
                    Sign out
                  </button>
                </div>
                {message ? (
                  <p
                    className={`status-note ${messageKind === "success" ? "success" : messageKind === "error" ? "error" : ""}`}
                    role="status"
                  >
                    {message}
                  </p>
                ) : null}
              </form>
            </SurfaceCard>
          ) : null}
          {hasSession && !mustChangePassword && !emailVerified ? (
            <SurfaceCard className="auth-card" style={{ maxWidth: 480, margin: "0 auto" }}>
              <h1 className="section-title" style={{ marginTop: 0 }}>Confirm your email</h1>
              <p className="section-lead">We need to verify {sessionEmail || "your address"} before you can link orders to this account and pay as a signed-in customer.</p>
              <p className="section-lead" style={{ fontSize: "0.9rem", marginTop: 8 }}>
                You can still{" "}
                <Link href="/cart" className="subtle-link" style={{ textDecoration: "underline" }}>
                  shop the cart
                </Link>{" "}
                and use{" "}
                <Link href="/checkout" className="subtle-link" style={{ textDecoration: "underline" }}>
                  guest checkout
                </Link>{" "}
                with a reachable email while you complete verification.
              </p>
              <div className="auth-actions" style={{ marginTop: 12, flexDirection: "column", alignItems: "stretch" }}>
                <ActionButton
                  type="button"
                  ghost
                  onClick={async () => {
                    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
                    if (!token) return;
                    setSubmitting(true);
                    try {
                      await resendVerification(token);
                      setMessageKind("success");
                      setMessage("Verification email sent. Check your inbox.");
                    } catch {
                      setMessageKind("error");
                      setMessage("Could not resend. Try again in a few minutes.");
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                >
                  Resend verification email
                </ActionButton>
                <button type="button" className="chip" onClick={logout} style={{ alignSelf: "center" }}>
                  Sign out
                </button>
              </div>
              {message ? (
                <p
                  className={`status-note ${messageKind === "success" ? "success" : messageKind === "error" ? "error" : ""}`}
                  style={{ marginTop: 10 }}
                >
                  {message}
                </p>
              ) : null}
            </SurfaceCard>
          ) : null}
          {hasSession && !mustChangePassword && emailVerified ? (
            <SurfaceCard className="auth-card" style={{ maxWidth: 480, margin: "0 auto" }}>
              <h1 className="section-title" style={{ marginTop: 0 }}>You are signed in</h1>
              <p className="section-lead">Account {sessionEmail} is verified. You can shop and use checkout.</p>
              <div className="auth-actions">
                <button type="button" className="chip" onClick={logout}>
                  Sign out
                </button>
              </div>
            </SurfaceCard>
          ) : null}
          {!hasSession && (
            <>
          <SurfaceCard className="auth-card">
            <div className="auth-header">
              <p className="route-eyebrow" style={{ margin: 0 }}>Account center</p>
              <h1 className="section-title auth-title">Secure access for reviews and order history</h1>
              <p className="section-lead auth-lead">
                Sign in or create an account to track orders, manage profile details, and leave verified purchase reviews.
              </p>
            </div>
            <div className="auth-kpis">
              <div className="auth-kpi"><span className="icon-inline"><BadgeCheck size={14} /> Verified buyer review access</span></div>
              <div className="auth-kpi"><span className="icon-inline"><ShieldCheck size={14} /> Protected login and secure checkout continuity</span></div>
              <div className="auth-kpi"><span className="icon-inline"><Gift size={14} /> Access to referral bonus</span></div>
              <div className="auth-kpi"><span className="icon-inline"><TicketPercent size={14} /> Coupons for verified users</span></div>
              <div className="auth-kpi"><span className="icon-inline"><Wallet size={14} /> Cashback rewards on eligible orders</span></div>
            </div>
          </SurfaceCard>
          <SurfaceCard className="auth-card">
            <div className="segmented" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                className="chip"
                role="tab"
                aria-selected={mode === "login"}
                onClick={() => setMode("login")}
              >
                Login
              </button>
              <button
                type="button"
                className="chip"
                role="tab"
                aria-selected={mode === "register"}
                onClick={() => setMode("register")}
              >
                Create account
              </button>
            </div>
            <form onSubmit={submit} className="auth-form">
              <div className="auth-grid">
                {mode === "register" ? (
                  <>
                    <div className="field">
                      <label htmlFor="first-name">First name</label>
                      <input id="first-name" className="text-input" autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                    </div>
                    <div className="field">
                      <label htmlFor="last-name">Last name</label>
                      <input id="last-name" className="text-input" autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
                    </div>
                    <div className="field">
                      <label htmlFor="phone">Phone</label>
                      <input id="phone" className="text-input" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
                    </div>
                  </>
                ) : null}
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input id="email" className="text-input" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="password">Password</label>
                  <div className="password-field">
                    <input
                      id="password"
                      className="text-input"
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                {mode === "register" ? (
                  <div className="field">
                    <label htmlFor="confirm-password">Repeat password</label>
                    <div className="password-field">
                      <input
                        id="confirm-password"
                        className="text-input"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword((value) => !value)}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="auth-actions">
                <ActionButton type="submit" disabled={submitting}>
                  {submitting ? "Securing..." : mode === "login" ? "Sign in" : "Create account"}
                </ActionButton>
                {mode === "login" ? (
                  <ActionButton ghost type="button" onClick={() => setResetOpen((v) => !v)}>
                    {resetOpen ? "Close password reset" : "Forgot password?"}
                  </ActionButton>
                ) : null}
                <small className="auth-meta">
                  <UserRound size={13} /> {mode === "login" ? "Welcome back access" : "New customer onboarding"}
                </small>
              </div>
              {resetOpen && mode === "login" ? (
                <div className="route-grid" style={{ gap: 8 }}>
                  <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
                    Reset with one-time email OTP.
                  </p>
                  {resetStep === "confirm" ? (
                    <>
                      <div className="field">
                        <label htmlFor="sf-reset-code">OTP code</label>
                        <input
                          id="sf-reset-code"
                          className="text-input"
                          inputMode="numeric"
                          maxLength={6}
                          value={resetCode}
                          onChange={(event) => setResetCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="sf-reset-pass">New password</label>
                        <input
                          id="sf-reset-pass"
                          className="text-input"
                          type="password"
                          autoComplete="new-password"
                          value={resetNewPassword}
                          onChange={(event) => setResetNewPassword(event.target.value)}
                        />
                      </div>
                    </>
                  ) : null}
                  <div className="auth-actions">
                    {resetStep === "request" ? (
                      <ActionButton type="button" onClick={() => void sendResetCode()} disabled={submitting}>
                        {submitting ? "Sending..." : "Send reset code"}
                      </ActionButton>
                    ) : (
                      <>
                        <ActionButton type="button" onClick={() => void applyReset()} disabled={submitting}>
                          {submitting ? "Resetting..." : "Reset password"}
                        </ActionButton>
                        <ActionButton ghost type="button" onClick={() => setResetStep("request")} disabled={submitting}>
                          Back
                        </ActionButton>
                      </>
                    )}
                  </div>
                  {resetMessage ? <p className="status-note">{resetMessage}</p> : null}
                </div>
              ) : null}
              {message ? (
                <p className={`status-note ${messageKind === "success" ? "success" : messageKind === "error" ? "error" : ""}`} role="status" aria-live="polite">
                  {message}
                </p>
              ) : null}
            </form>
          </SurfaceCard>
            </>
          )}
        </section>
      </section>
    </StorefrontShell>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <StorefrontShell>
          <div className="app-shell">
            <SurfaceCard className="route-card" style={{ padding: "1.5rem" }}>
              Loading account…
            </SurfaceCard>
          </div>
        </StorefrontShell>
      }
    >
      <AccountContent />
    </Suspense>
  );
}
