"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { ActionButton, BrandMark, SurfaceCard } from "@sexxymarket/ui";
import { BadgeCheck, MailCheck, ShieldCheck, Store } from "lucide-react";
import { ThemeToggle } from "../../components/theme-toggle";
import { PasswordField } from "../../components/password-field";
import { MERCHANT_NAME_KEY, MERCHANT_TOKEN_COOKIE, MERCHANT_TOKEN_KEY } from "../../lib/merchant-auth";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const storefrontBase = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3000";
const verifyInfoUrl = `${storefrontBase.replace(/\/$/, "")}/account/verify-email`;

type Step = "form" | "check_email";

export default function MerchantRegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const stepLabel = useMemo(() => {
    if (step === "form") return "Step 1 of 2";
    if (step === "check_email") return "Step 2 of 2";
    return "Step 2 of 2";
  }, [step]);

  const registerOnly = async () => {
    setMessage("");
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim() || !phone.trim()) {
      setMessage("Please complete all account fields before continuing.");
      return;
    }
    flushSync(() => {
      setSubmitting(true);
    });
    try {
      const registerResponse = await fetch(`${apiBase}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, password, phone }),
      });
      if (registerResponse.status === 409) {
        setMessage("That email is already registered. Log in, or use a different email.");
        return;
      }
      if (!registerResponse.ok) {
        setMessage("Registration failed. Check your details and try again.");
        return;
      }
      setStep("check_email");
    } catch {
      setMessage("Unable to reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const continueIfVerified = async () => {
    setMessage("");
    if (!email.trim() || !password.trim()) {
      setMessage("Missing account details. Return to step 1 and retry.");
      return;
    }
    flushSync(() => {
      setSubmitting(true);
    });
    try {
      const loginResponse = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!loginResponse.ok) {
        setMessage("Login failed. If you just registered, use the same password or recover access from storefront account tools.");
        return;
      }
      const loginPayload = (await loginResponse.json()) as {
        accessToken: string;
        user: { mustChangePassword?: boolean; emailVerified?: boolean; role: string };
      };
      if (loginPayload.user.mustChangePassword) {
        localStorage.setItem(MERCHANT_TOKEN_KEY, loginPayload.accessToken);
        document.cookie = `${MERCHANT_TOKEN_COOKIE}=${encodeURIComponent(loginPayload.accessToken)}; Path=/; SameSite=Lax`;
        localStorage.setItem(MERCHANT_NAME_KEY, firstName.trim() || "Merchant");
        router.push("/dashboard");
        return;
      }
      if (!loginPayload.user.emailVerified) {
        setMessage(
          "Please verify your email first. Open the link sent to your inbox, then return here. You can resend verification from storefront account settings.",
        );
        return;
      }
      localStorage.setItem(MERCHANT_TOKEN_KEY, loginPayload.accessToken);
      document.cookie = `${MERCHANT_TOKEN_COOKIE}=${encodeURIComponent(loginPayload.accessToken)}; Path=/; SameSite=Lax`;
      localStorage.setItem(MERCHANT_NAME_KEY, firstName.trim() || "Merchant");
      router.push("/dashboard");
    } catch {
      setMessage("Something went wrong. Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  const resendVerificationFromRegister = async () => {
    setMessage("");
    if (!email.trim() || !password.trim()) {
      setMessage("Missing account details. Return to step 1 and retry.");
      return;
    }
    flushSync(() => {
      setSubmitting(true);
    });
    try {
      const loginResponse = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!loginResponse.ok) {
        setMessage("Could not authenticate to resend verification email. Check credentials.");
        return;
      }
      const loginPayload = (await loginResponse.json()) as {
        accessToken: string;
        user: { emailVerified?: boolean };
      };
      if (loginPayload.user.emailVerified) {
        setMessage("Email is already verified. Click continue.");
        return;
      }
      const resendResponse = await fetch(`${apiBase}/api/auth/resend-verification`, {
        method: "POST",
        headers: { Authorization: `Bearer ${loginPayload.accessToken}` },
      });
      const body = (await resendResponse.json().catch(() => ({}))) as {
        message?: string | string[];
      };
      if (!resendResponse.ok) {
        const msg = Array.isArray(body.message) ? body.message[0] : body.message;
        setMessage(typeof msg === "string" ? msg : "Could not resend verification email.");
        return;
      }
      const msg = Array.isArray(body.message) ? body.message[0] : body.message;
      setMessage(typeof msg === "string" ? msg : "Verification email resent.");
    } catch {
      setMessage("Could not resend verification email right now.");
    } finally {
      setSubmitting(false);
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

      <main className="app-shell" style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div className="merchant-auth-grid merchant-auth-grid-wide">
          <div className="merchant-auth-hero">
            <p className="route-eyebrow" style={{ margin: 0 }}>Merchant onboarding</p>
            <h1 className="section-title" style={{ margin: "0.2rem 0" }}>Launch your seller workspace</h1>
            <p className="section-lead">
              Registration has three clear stages: account creation, email verification, and merchant application.
            </p>
            <ul className="merchant-auth-list">
              <li>Secure account with verified email before merchant application</li>
              <li>Apply from dashboard through a guided, professional process</li>
              <li>Tier and listing behavior are managed by admin governance</li>
            </ul>
            <div className="merchant-step-row" role="list" aria-label="Onboarding steps">
              <span role="listitem" className={`chip ${step === "form" ? "is-active" : ""}`}>1. Account</span>
              <span role="listitem" className={`chip ${step === "check_email" ? "is-active" : ""}`}>2. Verify email</span>
            </div>
            <p className="muted" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: "0.88rem" }}>
              <ShieldCheck size={16} />
              Use real business details and bank information that match legal identity records.
            </p>
          </div>

          <SurfaceCard style={{ padding: "1.2rem" }}>
            <p className="route-eyebrow">Create account</p>
            <h2 className="section-title" style={{ fontSize: "1.35rem", margin: "0.1rem 0" }}>{stepLabel}</h2>

            {step === "form" ? (
              <form
                className="route-grid"
                style={{ marginTop: 12, gap: 10 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  void registerOnly();
                }}
              >
                <div className="merchant-auth-two-col">
                  <div className="field">
                    <label htmlFor="first-name">First name</label>
                    <input id="first-name" className="text-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="last-name">Last name</label>
                    <input id="last-name" className="text-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="reg-email">Email</label>
                    <input id="reg-email" className="text-input" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="reg-phone">Phone</label>
                    <input id="reg-phone" className="text-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="reg-password">Password</label>
                  <PasswordField id="reg-password" value={password} onChange={setPassword} />
                </div>
                <ActionButton
                  type="submit"
                  isLoading={submitting}
                  loadingText="Creating account…"
                  disabled={submitting}
                >
                  Create account and send verification email
                </ActionButton>
              </form>
            ) : null}

            {step === "check_email" ? (
              <div className="route-grid" style={{ marginTop: 12, gap: 10 }}>
                <p className="section-lead" style={{ fontSize: "0.92rem" }}>
                  We sent a verification link to <strong>{email}</strong>. Confirm your email, then continue to dashboard.
                </p>
                <p className="muted" style={{ margin: 0, fontSize: "0.88rem", display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <MailCheck size={15} />
                  Verification page reference: <a href={verifyInfoUrl} target="_blank" rel="noreferrer" className="subtle-link">{verifyInfoUrl}</a>
                </p>
                <div className="actions-row">
                  <ActionButton
                    isLoading={submitting}
                    loadingText="Checking…"
                    onClick={() => void continueIfVerified()}
                    disabled={submitting}
                  >
                    I verified my email — continue
                  </ActionButton>
                  <ActionButton
                    ghost
                    isLoading={submitting}
                    loadingText="Resending…"
                    onClick={() => void resendVerificationFromRegister()}
                    disabled={submitting}
                  >
                    Resend verification email
                  </ActionButton>
                  <ActionButton ghost onClick={() => setStep("form")}>Back</ActionButton>
                </div>
              </div>
            ) : null}

            {message ? (
              <p role="alert" style={{ color: "var(--ui-danger)", marginTop: 12 }}>
                {message}
              </p>
            ) : null}

            <div className="merchant-auth-footer">
              <p className="muted" style={{ margin: 0 }}>
                Already have an account? <Link href="/login" className="subtle-link">Log in</Link>
              </p>
              <p className="muted" style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Store size={14} />
                After login, your dashboard will guide merchant application and show approval status.
              </p>
              <p className="muted" style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <BadgeCheck size={14} />
                Email verification is mandatory before merchant application submission.
              </p>
            </div>
          </SurfaceCard>
        </div>
      </main>
    </>
  );
}


