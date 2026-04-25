"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionButton, BrandMark, MetricTile, StarRow, SurfaceCard } from "@sexxymarket/ui";
import { ThemeToggle } from "../../components/theme-toggle";
import {
  MerchantVerificationGateModal,
  type MerchantGateKind,
} from "../../components/merchant-verification-gate-modal";
import { MERCHANT_NAME_KEY, MERCHANT_TOKEN_COOKIE, MERCHANT_TOKEN_KEY } from "../../lib/merchant-auth";

type MerchantProduct = {
  id: string;
  name: string;
  priceNgn: number;
  stock: number;
  approvalStatus: string;
  category?: { name: string };
};

type MerchantOrder = {
  quantity: number;
  lineTotalNgn: number;
  order: { id: string; status: string; recipientName: string };
  product: { name: string };
};

type MerchantReview = {
  id: string;
  rating: number;
  comment: string;
  product: { name: string };
  user: { firstName: string; lastName: string };
};

type MerchantProfile = {
  id: string;
  merchantCode: string;
  businessName: string;
  businessType: "INDIVIDUAL" | "REGISTERED_BUSINESS";
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED";
  status: string;
  verifications?: Array<{ id: string; status: "PENDING" | "APPROVED" | "REJECTED" }>;
  contactAddress?: string;
  businessAddress?: string;
  user?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  payoutAccountName?: string;
  payoutAccountNoMasked?: string;
  payoutBankCode?: string;
};
type StateLgaRow = { state: string; lgas: string[] };
type BankRow = { code: string; name: string };

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const storefrontBase = (process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3000").replace(/\/$/, "");
const NIGERIA_GEO_DATA_URL =
  "https://gist.githubusercontent.com/devhammed/0bb9eeac9ff22c895100d072f489dc98/raw";

const buildAddress = (parts: {
  houseNo: string;
  street: string;
  city: string;
  state: string;
  lga: string;
  landmark?: string;
}) =>
  [
    `${parts.houseNo.trim()} ${parts.street.trim()}`.trim(),
    parts.city.trim(),
    parts.lga.trim(),
    parts.state.trim(),
    parts.landmark?.trim() ? `Landmark: ${parts.landmark.trim()}` : "",
  ]
    .filter(Boolean)
    .join(", ");

export default function MerchantDashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "products" | "orders" | "reviews" | "analytics" | "profile" | "support">("overview");
  const [merchantName] = useState(() => {
    if (typeof window === "undefined") return "Merchant";
    return localStorage.getItem(MERCHANT_NAME_KEY) ?? "Merchant";
  });
  const [token] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(MERCHANT_TOKEN_KEY) ?? "";
  });
  const [products, setProducts] = useState<MerchantProduct[]>([]);
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [reviews, setReviews] = useState<MerchantReview[]>([]);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [messageKind, setMessageKind] = useState<"error" | "success">("error");
  const [meLoaded, setMeLoaded] = useState(false);
  const [sessionValid, setSessionValid] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resending, setResending] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [merchantProfile, setMerchantProfile] = useState<MerchantProfile | null>(null);
  const [needsApplication, setNeedsApplication] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [applicationBusy, setApplicationBusy] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [applyBusinessName, setApplyBusinessName] = useState("");
  const [applyHouseNo, setApplyHouseNo] = useState("");
  const [applyStreet, setApplyStreet] = useState("");
  const [applyCity, setApplyCity] = useState("");
  const [applyState, setApplyState] = useState("");
  const [applyLga, setApplyLga] = useState("");
  const [applyLandmark, setApplyLandmark] = useState("");
  const [applyHasPhysicalLocation, setApplyHasPhysicalLocation] = useState(true);
  const [applyBusinessType, setApplyBusinessType] = useState<"INDIVIDUAL" | "REGISTERED_BUSINESS">("REGISTERED_BUSINESS");
  const [applicationStep, setApplicationStep] = useState<"terms" | "details">("terms");
  const [stateLgaRows, setStateLgaRows] = useState<StateLgaRow[]>([]);
  const [banks, setBanks] = useState<BankRow[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [resolvingAccountName, setResolvingAccountName] = useState(false);
  const [accountLookupHint, setAccountLookupHint] = useState("");
  const [showVerifyPrompt, setShowVerifyPrompt] = useState(false);
  const [guardModalKind, setGuardModalKind] = useState<MerchantGateKind | null>(null);
  const [showVerificationSheet, setShowVerificationSheet] = useState(false);
  const [payoutChallengeId, setPayoutChallengeId] = useState("");
  const [payoutOtpCode, setPayoutOtpCode] = useState("");
  const [supportCategory, setSupportCategory] = useState<"ORDER" | "PRODUCT" | "TRANSACTION" | "ACCOUNT" | "GENERAL">("GENERAL");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportOrderId, setSupportOrderId] = useState("");
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [supportRows, setSupportRows] = useState<
    Array<{ id: string; category: string; subject: string; status: string; createdAt: string }>
  >([]);
  const bankResolveRequestRef = useRef(0);
  const supportReferenceLabel =
    supportCategory === "ORDER"
      ? "Order ID (optional)"
      : supportCategory === "PRODUCT"
        ? "Product ID (optional)"
        : supportCategory === "TRANSACTION"
          ? "Transaction ID (optional)"
          : supportCategory === "ACCOUNT"
            ? "Account reference (optional)"
            : "Reference ID (optional)";

  useEffect(() => {
    if (!token) {
      document.cookie = `${MERCHANT_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
      router.push("/login");
    }
  }, [router, token]);

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    void fetch(`${apiBase}/api/auth/me`, { headers })
      .then(async (r) => {
        if (!r.ok) {
          localStorage.removeItem(MERCHANT_TOKEN_KEY);
          document.cookie = `${MERCHANT_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
          setSessionValid(false);
          setMeLoaded(true);
          router.push("/login");
          return;
        }
        return r.json() as Promise<{ mustChangePassword?: boolean; emailVerified?: boolean }>;
      })
      .then((me) => {
        if (!me) return;
        setSessionValid(true);
        setMustChangePassword(!!me.mustChangePassword);
        setEmailVerified(!!me.emailVerified);
        setMeLoaded(true);
      })
      .catch(() => {
        setSessionValid(false);
        setMeLoaded(true);
        localStorage.removeItem(MERCHANT_TOKEN_KEY);
        document.cookie = `${MERCHANT_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
        router.push("/login");
      });
  }, [apiBase, router, token]);

  useEffect(() => {
    void fetch(NIGERIA_GEO_DATA_URL)
      .then((r) => r.json())
      .then((rows) => {
        const normalized = Array.isArray(rows)
          ? rows
              .map((row) => ({
                state: String(row?.state ?? ""),
                lgas: Array.isArray(row?.lgas) ? row.lgas.map((lga: unknown) => String(lga)) : [],
              }))
              .filter((row) => row.state && row.lgas.length)
          : [];
        setStateLgaRows(normalized);
      })
      .catch(() => setStateLgaRows([]));
  }, []);

  useEffect(() => {
    if (!token || !meLoaded || mustChangePassword || !emailVerified) return;
    const headers = { Authorization: `Bearer ${token}` };
    setProfileLoaded(false);
    void fetch(`${apiBase}/api/merchant/profile`, { headers })
      .then(async (response) => {
        if (response.status === 404) {
          setMerchantProfile(null);
          setNeedsApplication(true);
          setRequiresApproval(false);
          setProfileLoaded(true);
          return;
        }
        if (!response.ok) {
          setNeedsApplication(true);
          setRequiresApproval(false);
          setProfileLoaded(true);
          setLoadError("Could not load merchant profile.");
          return;
        }
        const profile = (await response.json()) as MerchantProfile & {
          businessAddress?: string;
        };
        setMerchantProfile(profile);
        setNeedsApplication(false);
        const hasSubmittedVerification = !!profile.verifications?.length;
        setRequiresApproval(profile.verificationStatus === "PENDING" && hasSubmittedVerification);
        setProfileLoaded(true);
        setApplyBusinessName(profile.businessName ?? "");
      })
      .catch(() => {
        setNeedsApplication(true);
        setRequiresApproval(false);
        setProfileLoaded(true);
        setLoadError("Could not load merchant profile.");
      });
  }, [apiBase, emailVerified, meLoaded, mustChangePassword, token]);

  useEffect(() => {
    if (!token) return;
    void fetch(`${apiBase}/api/merchant/banks`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setBanks(Array.isArray(rows) ? rows : []))
      .catch(() => setBanks([]));
  }, [apiBase, token]);

  const verificationLocked = needsApplication || requiresApproval;
  const shouldShowVerifyPrompt = needsApplication;

  useEffect(() => {
    if (!meLoaded || !emailVerified || mustChangePassword || !shouldShowVerifyPrompt) {
      setShowVerifyPrompt(false);
      return;
    }
    const timer = window.setTimeout(() => setShowVerifyPrompt(true), 2200);
    return () => window.clearTimeout(timer);
  }, [meLoaded, emailVerified, mustChangePassword, shouldShowVerifyPrompt]);

  useEffect(() => {
    if (tab !== "support" || !token) return;
    void fetch(`${apiBase}/api/merchant/support/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) =>
        setSupportRows(
          Array.isArray(rows)
            ? rows
            : [],
        ),
      )
      .catch(() => undefined);
  }, [tab, token, apiBase]);

  useEffect(() => {
    if (
      !token ||
      !meLoaded ||
      mustChangePassword ||
      !emailVerified ||
      !profileLoaded
    ) {
      return;
    }
    setLoadError("");
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${apiBase}/api/catalog/products/merchant/mine`, { headers }).then((response) => response.json()),
      fetch(`${apiBase}/api/merchant/orders`, { headers }).then((response) => response.json()),
      fetch(`${apiBase}/api/reviews/merchant/mine`, { headers }).then((response) => response.json()),
    ])
      .then(([productPayload, orderPayload, reviewPayload]) => {
        setProducts(Array.isArray(productPayload) ? productPayload : []);
        setOrders(Array.isArray(orderPayload) ? orderPayload : []);
        setReviews(Array.isArray(reviewPayload) ? reviewPayload : []);
      })
      .catch(() => setLoadError("Unable to load dashboard data."));
  }, [apiBase, meLoaded, mustChangePassword, emailVerified, token, profileLoaded]);

  const applyPasswordChange = async () => {
    if (newPassword.length < 8 || newPassword !== confirmNewPassword) {
      setMessageKind("error");
      setMessage("New password must match and be at least 8 characters.");
      return;
    }
    flushSync(() => {
      setPasswordBusy(true);
    });
    try {
      const response = await fetch(`${apiBase}/api/auth/change-password`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!response.ok) {
        setMessageKind("error");
        setMessage("Could not update password. Check the current password.");
        return;
      }
      const payload = (await response.json()) as {
        accessToken: string;
        user: { mustChangePassword?: boolean; emailVerified?: boolean };
      };
      localStorage.setItem(MERCHANT_TOKEN_KEY, payload.accessToken);
      document.cookie = `${MERCHANT_TOKEN_COOKIE}=${encodeURIComponent(payload.accessToken)}; Path=/; SameSite=Lax`;
      setMustChangePassword(!!payload.user?.mustChangePassword);
      setEmailVerified(!!payload.user?.emailVerified);
      setMessageKind("success");
      setMessage(
        payload.user?.emailVerified
          ? "Password updated."
          : "Password updated. Please confirm your email using the link we sent you, or resend from this page.",
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch {
      setMessageKind("error");
      setMessage("Password change failed.");
    } finally {
      setPasswordBusy(false);
    }
  };

  const resendVerification = async () => {
    if (!token) return;
    flushSync(() => {
      setResending(true);
    });
    setMessage("");
    try {
      const r = await fetch(`${apiBase}/api/auth/resend-verification`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await r.json().catch(() => ({}))) as { message?: string };
      if (!r.ok) {
        setMessageKind("error");
        setMessage("Could not resend. Try again in a few minutes.");
        return;
      }
      setMessageKind("success");
      setMessage(body.message ?? "If your email is not verified, we have sent a new link.");
    } catch {
      setMessageKind("error");
      setMessage("Could not resend the email.");
    } finally {
      setResending(false);
    }
  };

  const analytics = useMemo(() => {
    const grossSales = orders.reduce((sum, order) => sum + order.lineTotalNgn, 0);
    const viewsEstimate = products.reduce((sum, _, index) => sum + 320 - index * 9, 0);
    const searchesEstimate = Math.round(viewsEstimate * 0.36);
    const averageRating = reviews.length
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;
    return { grossSales, viewsEstimate, searchesEstimate, averageRating };
  }, [orders, products, reviews]);

  const logout = () => {
    localStorage.removeItem(MERCHANT_TOKEN_KEY);
    document.cookie = `${MERCHANT_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    router.push("/login");
  };

  const guardRestrictedAction = (actionName: string) => {
    if (!verificationLocked) {
      return false;
    }
    if (requiresApproval) {
      setGuardModalKind("awaiting_approval");
      return true;
    }
    setMessageKind("error");
    setMessage(`Verify your merchant account first to ${actionName}.`);
    setGuardModalKind("needs_verification");
    return true;
  };

  const hasSubmittedVerification = !!merchantProfile?.verifications?.length;
  const verificationChipLabel = !merchantProfile || !hasSubmittedVerification
    ? "Verify now"
    : merchantProfile.verificationStatus === "APPROVED"
      ? "Verified"
      : merchantProfile.verificationStatus === "PENDING"
        ? "Awaiting approval"
        : "Verify now";

  const submitApplication = async () => {
    setMessage("");
    if (!termsAccepted) {
      setMessageKind("error");
      setMessage("You must agree to the terms and policy to continue.");
      return;
    }
    if (
      !applyBusinessName.trim() ||
      !applyHouseNo.trim() ||
      !applyStreet.trim() ||
      !applyCity.trim() ||
      !applyState.trim() ||
      !applyLga.trim()
    ) {
      setMessageKind("error");
      setMessage("Please complete all required application fields.");
      return;
    }
    setApplicationBusy(true);
    try {
      const response = await fetch(`${apiBase}/api/merchant/apply`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessName: applyBusinessName.trim(),
          businessAddress: buildAddress({
            houseNo: applyHouseNo,
            street: applyStreet,
            city: applyCity,
            lga: applyLga,
            state: applyState,
            landmark: applyLandmark,
          }),
          hasPhysicalLocation: applyHasPhysicalLocation,
          businessType: applyBusinessType,
          agreementAccepted: true,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
        const err =
          Array.isArray(body.message) ? body.message[0] : body.message;
        throw new Error(typeof err === "string" ? err : "Could not submit application.");
      }
      setMessageKind("success");
      setMessage("Application submitted successfully. Awaiting admin approval.");
      setNeedsApplication(false);
      setRequiresApproval(false);
      setProfileLoaded(false);
      const profileResponse = await fetch(`${apiBase}/api/merchant/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (profileResponse.ok) {
        const profile = (await profileResponse.json()) as MerchantProfile;
        setMerchantProfile(profile);
        const submittedVerification = !!profile.verifications?.length;
        setRequiresApproval(profile.verificationStatus === "PENDING" && submittedVerification);
      }
      setProfileLoaded(true);
    } catch (error) {
      setNeedsApplication(true);
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : "Application failed.");
    } finally {
      setApplicationBusy(false);
    }
  };

  const goToApplicationDetails = () => {
    setMessage("");
    if (!termsAccepted) {
      setMessageKind("error");
      setMessage("You must agree to the terms and policy to continue.");
      return;
    }
    setApplicationStep("details");
  };

  const resolveAccountName = async () => {
    if (!token || !bankCode || accountNumber.trim().length !== 10) return;
    const requestId = bankResolveRequestRef.current + 1;
    bankResolveRequestRef.current = requestId;
    setResolvingAccountName(true);
    const payload = { bankCode, accountNumber: accountNumber.trim() };
    const runAttempt = async () =>
      fetch(`${apiBase}/api/merchant/payout-account/resolve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

    let response: Response;
    try {
      response = await runAttempt();
    } catch {
      if (requestId !== bankResolveRequestRef.current) return;
      setAccountLookupHint("Bank lookup failed, retrying...");
      try {
        response = await runAttempt();
      } catch {
        if (requestId !== bankResolveRequestRef.current) return;
        setResolvingAccountName(false);
        setAccountName("");
        setAccountLookupHint("");
        setMessageKind("error");
        setMessage("Could not resolve account name right now. Please try again.");
        return;
      }
    }

    const body = (await response.json().catch(() => ({}))) as { accountName?: string; message?: string };
    if (requestId !== bankResolveRequestRef.current) return;
    if (!response.ok || !body.accountName) {
      const shouldRetry = response.status >= 500;
      if (shouldRetry) {
        setAccountLookupHint("Bank lookup failed, retrying...");
        try {
          const retryResponse = await runAttempt();
          const retryBody = (await retryResponse.json().catch(() => ({}))) as { accountName?: string; message?: string };
          if (requestId !== bankResolveRequestRef.current) return;
          setResolvingAccountName(false);
          if (!retryResponse.ok || !retryBody.accountName) {
            setAccountName("");
            setAccountLookupHint("");
            setMessageKind("error");
            setMessage(typeof retryBody.message === "string" ? retryBody.message : "Could not resolve account name.");
            return;
          }
          setAccountLookupHint("");
          setAccountName(retryBody.accountName);
          return;
        } catch {
          if (requestId !== bankResolveRequestRef.current) return;
          setResolvingAccountName(false);
          setAccountName("");
          setAccountLookupHint("");
          setMessageKind("error");
          setMessage("Could not resolve account name right now. Please try again.");
          return;
        }
      }
      setResolvingAccountName(false);
      setAccountName("");
      setAccountLookupHint("");
      setMessageKind("error");
      setMessage(typeof body.message === "string" ? body.message : "Could not resolve account name.");
      return;
    }
    setResolvingAccountName(false);
    setAccountLookupHint("");
    setAccountName(body.accountName);
  };

  useEffect(() => {
    if (!token || !bankCode || accountNumber.trim().length !== 10) return;
    const timer = window.setTimeout(() => {
      void resolveAccountName();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [token, bankCode, accountNumber]);

  const startSettlementOtp = async () => {
    if (!token || !bankCode || accountNumber.trim().length !== 10) {
      setMessageKind("error");
      setMessage("Choose bank and enter a valid 10-digit account number.");
      return;
    }
    flushSync(() => {
      setPayoutBusy(true);
    });
    try {
      const response = await fetch(`${apiBase}/api/merchant/payout-account/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ bankCode, accountNumber: accountNumber.trim() }),
      });
      const body = (await response.json().catch(() => ({}))) as { challengeId?: string; message?: string; accountName?: string };
      if (!response.ok || !body.challengeId) {
        setMessageKind("error");
        setMessage(typeof body.message === "string" ? body.message : "Could not start account verification.");
        return;
      }
      setPayoutChallengeId(body.challengeId);
      setAccountName(body.accountName ?? accountName);
      setMessageKind("success");
      setMessage("Verification code sent to your email. Enter the code to save this account.");
    } finally {
      setPayoutBusy(false);
    }
  };

  const confirmSettlementOtp = async () => {
    if (!token || !payoutChallengeId || !payoutOtpCode.trim()) {
      setMessageKind("error");
      setMessage("Enter the verification code sent to your email.");
      return;
    }
    flushSync(() => {
      setPayoutBusy(true);
    });
    try {
      const response = await fetch(`${apiBase}/api/merchant/payout-account/confirm`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: payoutChallengeId, code: payoutOtpCode.trim() }),
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      setMessageKind(response.ok ? "success" : "error");
      setMessage(
        response.ok
          ? "Settlement account saved successfully."
          : typeof body.message === "string"
            ? body.message
            : "Could not verify code.",
      );
      if (response.ok) {
        setPayoutChallengeId("");
        setPayoutOtpCode("");
        const profileResponse = await fetch(`${apiBase}/api/merchant/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (profileResponse.ok) {
          const profile = (await profileResponse.json()) as MerchantProfile;
          setMerchantProfile(profile);
        }
      }
    } finally {
      setPayoutBusy(false);
    }
  };

  const loadSupportMessages = async () => {
    if (!token) return;
    const response = await fetch(`${apiBase}/api/merchant/support/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    const rows = (await response.json()) as Array<{ id: string; category: string; subject: string; status: string; createdAt: string }>;
    setSupportRows(Array.isArray(rows) ? rows : []);
  };

  const submitSupportMessage = async () => {
    if (!token || supportSubject.trim().length < 3 || supportMessage.trim().length < 10) {
      setMessageKind("error");
      setMessage("Enter a clear subject and detailed message.");
      return;
    }
    flushSync(() => {
      setSupportSubmitting(true);
    });
    try {
      const response = await fetch(`${apiBase}/api/merchant/support/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          category: supportCategory,
          subject: supportSubject.trim(),
          message: supportMessage.trim(),
          orderId: supportOrderId.trim() || undefined,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string; id?: string };
      setMessageKind(response.ok ? "success" : "error");
      setMessage(
        response.ok
          ? `Support ticket sent${body.id ? ` (#${body.id.slice(0, 8)})` : ""}.`
          : typeof body.message === "string"
            ? body.message
            : "Could not send support message.",
      );
      if (response.ok) {
        setSupportSubject("");
        setSupportMessage("");
        setSupportOrderId("");
        await loadSupportMessages();
      }
    } finally {
      setSupportSubmitting(false);
    }
  };

  if (!token || !meLoaded || !sessionValid) {
    return (
      <main className="app-shell" style={{ padding: "3rem 1rem", textAlign: "center" }}>
        <p className="muted">Verifying session…</p>
      </main>
    );
  }

  return (
    <>
      <header className="top-nav">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BrandMark size={38} />
          <div>
            <strong>Merchant Dashboard</strong>
            <div style={{ color: "var(--ui-muted)", fontSize: "0.84rem" }}>Welcome, {merchantName}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="chip"
            aria-label="Merchant verification status"
            onClick={() => {
              if (verificationChipLabel === "Verify now") {
                router.push("/verify");
                return;
              }
              setShowVerificationSheet(true);
            }}
          >
            {verificationChipLabel}
          </button>
          <Link
            href="/products"
            className="chip"
            style={{ textDecoration: "none" }}
            onClick={(event) => {
              if (guardRestrictedAction("manage products")) {
                event.preventDefault();
              }
            }}
          >
            Products
          </Link>
          <ThemeToggle />
          <ActionButton ghost onClick={logout}>
            Logout
          </ActionButton>
        </div>
      </header>

      <main className="app-shell route-grid">
        {showVerificationSheet ? (
          <div style={{ position: "fixed", right: 16, bottom: 16, zIndex: 85, width: "min(92vw, 480px)" }}>
            <SurfaceCard style={{ padding: "1rem" }}>
              <p className="route-eyebrow" style={{ margin: 0 }}>
                Merchant verification
              </p>
              <h3 style={{ marginTop: 6, marginBottom: 8 }}>
                {merchantProfile?.verificationStatus === "APPROVED" ? "Merchant approved" : "Awaiting approval"}
              </h3>
              <p className="muted" style={{ marginTop: 0 }}>
                {merchantProfile?.verificationStatus === "APPROVED"
                  ? "Your merchant verification is approved. Compliance checks may still be performed during operations."
                  : "Your application has been submitted. Compliance review is in progress and may include physical verification, phone calls, or email follow-up."}
              </p>
              <div
                style={{
                  border: "1px solid var(--ui-border)",
                  borderRadius: 12,
                  padding: "0.75rem",
                  background: "color-mix(in oklab, var(--ui-surface) 88%, var(--ui-bg))",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.88rem" }}>
                  <strong>Business:</strong> {merchantProfile?.businessName ?? "—"}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "0.88rem" }}>
                  <strong>Type:</strong> {merchantProfile?.businessType === "REGISTERED_BUSINESS" ? "Registered business" : "Unregistered business"}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "0.88rem" }}>
                  <strong>Status:</strong> {merchantProfile?.verificationStatus ?? "—"}
                </p>
              </div>
              <div className="actions-row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
                <ActionButton ghost onClick={() => setShowVerificationSheet(false)}>
                  Close
                </ActionButton>
                {merchantProfile?.verificationStatus !== "APPROVED" ? (
                  <ActionButton onClick={() => router.push("/verify")}>Review or edit application</ActionButton>
                ) : merchantProfile?.businessType === "INDIVIDUAL" ? (
                  <ActionButton onClick={() => router.push("/verify")}>Upgrade to registered business</ActionButton>
                ) : null}
              </div>
            </SurfaceCard>
          </div>
        ) : null}

        {!meLoaded && !mustChangePassword ? (
          <p className="muted" style={{ margin: "0 auto" }}>
            Loading your account…
          </p>
        ) : null}

        {meLoaded && mustChangePassword ? (
          <SurfaceCard style={{ padding: "1.1rem", maxWidth: 520, margin: "0 auto" }}>
            <h2 style={{ marginTop: 0 }}>Set a new password</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              For security, replace the temporary password you received by email. Then open the link in the same message to
              verify your email, or resend it from the next step.
            </p>
            <div className="field" style={{ marginTop: 10 }}>
              <label>Current (temporary) password</label>
              <input
                className="text-input"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="field">
              <label>New password</label>
              <input
                className="text-input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Confirm new password</label>
              <input
                className="text-input"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
              />
            </div>
            <ActionButton
              isLoading={passwordBusy}
              loadingText="Updating…"
              onClick={() => void applyPasswordChange()}
            >
              Update password and continue
            </ActionButton>
            {message ? (
              <p
                style={{
                  color: messageKind === "success" ? "var(--ui-success, #16a34a)" : "var(--ui-danger)",
                  marginTop: 8,
                }}
              >
                {message}
              </p>
            ) : null}
          </SurfaceCard>
        ) : null}

        {meLoaded && !mustChangePassword && !emailVerified ? (
          <SurfaceCard style={{ padding: "1.1rem", maxWidth: 520, margin: "0 auto" }}>
            <h2 style={{ marginTop: 0 }}>Confirm your email</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Open the verification link we sent you (it opens the Sexxy Market storefront). After you verify, this page
              will show your dashboard. You can resend the email if the link expired.
            </p>
            <p style={{ marginTop: 8, fontSize: "0.9rem" }}>
              <a href={`${storefrontBase}/account/verify-email`} target="_blank" rel="noreferrer">
                Open verification help page
              </a>
            </p>
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <ActionButton
                isLoading={resending}
                loadingText="Sending…"
                onClick={() => void resendVerification()}
                disabled={resending}
              >
                Resend verification email
              </ActionButton>
            </div>
            {message ? (
              <p
                style={{
                  color: messageKind === "success" ? "var(--ui-success, #16a34a)" : "var(--ui-danger)",
                  marginTop: 12,
                }}
              >
                {message}
              </p>
            ) : null}
            <p style={{ marginTop: 16, color: "var(--ui-muted)", fontSize: "0.88rem" }}>
              Tip: If you have already confirmed your email, refresh this page. Your session is updated on the next
              request.
            </p>
            <div style={{ marginTop: 8 }}>
              <ActionButton ghost onClick={() => location.reload()}>
                I verified — refresh
              </ActionButton>
            </div>
          </SurfaceCard>
        ) : null}

        {meLoaded && !mustChangePassword && emailVerified ? (
        <>
        {showVerifyPrompt ? (
          <div style={{ position: "fixed", right: 16, bottom: 16, zIndex: 80, width: "min(92vw, 420px)" }}>
            <SurfaceCard style={{ padding: "1rem" }}>
              <p className="route-eyebrow" style={{ margin: 0 }}>
                Verification required
              </p>
              <h3 style={{ marginTop: 6, marginBottom: 8 }}>
                Verify to list products and unlock merchant tools
              </h3>
              <p className="muted" style={{ marginTop: 0 }}>
                Your dashboard is visible, but actions stay locked until your verification is submitted and approved.
              </p>
              <div className="actions-row" style={{ justifyContent: "flex-end" }}>
                <ActionButton ghost onClick={() => setShowVerifyPrompt(false)}>
                  Later
                </ActionButton>
                <ActionButton onClick={() => router.push("/verify")}>Verify now</ActionButton>
              </div>
            </SurfaceCard>
          </div>
        ) : null}

        {guardModalKind ? (
          <div
            style={{
              position: "fixed",
              right: 16,
              bottom: showVerifyPrompt ? 140 : 16,
              zIndex: 82,
              width: "min(92vw, 440px)",
            }}
          >
            <MerchantVerificationGateModal kind={guardModalKind} onClose={() => setGuardModalKind(null)} />
          </div>
        ) : null}

        <SurfaceCard style={{ padding: "0.85rem" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["overview", "products", "orders", "reviews", "analytics", "profile", "support"] as const).map((item) => (
              <button
                key={item}
                className="chip"
                aria-pressed={tab === item}
                onClick={() => {
                  if (
                    !["overview", "profile", "support"].includes(item) &&
                    guardRestrictedAction(`open ${item}`)
                  ) {
                    return;
                  }
                  setTab(item);
                }}
              >
                {item[0].toUpperCase()}
                {item.slice(1)}
              </button>
            ))}
          </div>
        </SurfaceCard>

        {tab === "overview" ? (
          <section style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
            <button
              type="button"
              onClick={() => {
                if (guardRestrictedAction("view products")) return;
                setTab("products");
              }}
              style={{ border: "none", background: "none", padding: 0, width: "100%", textAlign: "left", cursor: "pointer" }}
            >
              <MetricTile label="Products" value={String(products.length)} meta="Published + pending" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (guardRestrictedAction("view orders")) return;
                setTab("orders");
              }}
              style={{ border: "none", background: "none", padding: 0, width: "100%", textAlign: "left", cursor: "pointer" }}
            >
              <MetricTile label="Order lines" value={String(orders.length)} meta="Across all statuses" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (guardRestrictedAction("view reviews")) return;
                setTab("reviews");
              }}
              style={{ border: "none", background: "none", padding: 0, width: "100%", textAlign: "left", cursor: "pointer" }}
            >
              <MetricTile label="Reviews" value={String(reviews.length)} meta="Buyer generated" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (guardRestrictedAction("view analytics")) return;
                setTab("analytics");
              }}
              style={{ border: "none", background: "none", padding: 0, width: "100%", textAlign: "left", cursor: "pointer" }}
            >
              <MetricTile label="Estimated views" value={analytics.viewsEstimate.toLocaleString()} meta="Last 30 days" />
            </button>
          </section>
        ) : null}
        {tab === "profile" ? (
          <div className="route-grid" style={{ gap: 10 }}>
            <SurfaceCard style={{ padding: "1rem" }}>
              <h2 style={{ marginTop: 0 }}>Merchant profile</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                Name, business identity and addresses are locked after verification approval.
              </p>
              <div className="merchant-auth-two-col">
                <div className="field"><label>Merchant ID</label><input className="text-input" value={merchantProfile?.merchantCode ?? ""} readOnly /></div>
                <div className="field"><label>Name</label><input className="text-input" value={`${merchantProfile?.user?.firstName ?? ""} ${merchantProfile?.user?.lastName ?? ""}`.trim()} readOnly /></div>
                <div className="field"><label>Business name</label><input className="text-input" value={merchantProfile?.businessName ?? ""} readOnly /></div>
                <div className="field"><label>Address</label><input className="text-input" value={merchantProfile?.contactAddress ?? ""} readOnly /></div>
                <div className="field merchant-span-full"><label>Business address</label><input className="text-input" value={merchantProfile?.businessAddress ?? ""} readOnly /></div>
              </div>
            </SurfaceCard>
            <SurfaceCard style={{ padding: "1rem" }}>
              <h3 style={{ marginTop: 0 }}>Bank details</h3>
              <p className="muted" style={{ marginTop: 0 }}>
                Add settlement account and confirm via email code before saving.
              </p>
              <div className="merchant-auth-two-col">
                <div className="field">
                  <label>Bank</label>
                  <select
                    className="text-input"
                    value={bankCode}
                    onChange={(e) => {
                      setBankCode(e.target.value);
                      setAccountName("");
                      setAccountLookupHint("");
                      setPayoutChallengeId("");
                      setPayoutOtpCode("");
                    }}
                  >
                    <option value="">Select bank</option>
                    {banks.map((bank) => <option key={bank.code} value={bank.code}>{bank.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Account number</label>
                  <input
                    className="text-input"
                    value={accountNumber}
                    onChange={(e) => {
                      setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10));
                      setAccountName("");
                      setAccountLookupHint("");
                      setPayoutChallengeId("");
                      setPayoutOtpCode("");
                    }}
                  />
                </div>
                <div className="field merchant-span-full">
                  <label>Resolved account name</label>
                  <input
                    className="text-input"
                    value={resolvingAccountName ? "Resolving account name..." : accountName}
                    placeholder="Account name will appear automatically"
                    readOnly
                  />
                  {accountLookupHint ? (
                    <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.8rem" }}>
                      {accountLookupHint}
                    </p>
                  ) : null}
                </div>
                {payoutChallengeId ? (
                  <div className="field merchant-span-full">
                    <label>Email verification code</label>
                    <input className="text-input" value={payoutOtpCode} onChange={(e) => setPayoutOtpCode(e.target.value)} placeholder="Enter code from email" />
                  </div>
                ) : null}
              </div>
              <div className="actions-row">
                <ActionButton
                  isLoading={payoutBusy && !payoutChallengeId}
                  loadingText="Sending code…"
                  onClick={() => void startSettlementOtp()}
                >
                  Save bank details
                </ActionButton>
                {payoutChallengeId ? (
                  <ActionButton
                    isLoading={payoutBusy}
                    loadingText="Saving…"
                    onClick={() => void confirmSettlementOtp()}
                  >
                    Confirm &amp; save
                  </ActionButton>
                ) : null}
              </div>
              {merchantProfile?.payoutAccountName ? (
                <p className="muted" style={{ marginTop: 8 }}>
                  Current payout: {merchantProfile.payoutAccountName} · {merchantProfile.payoutAccountNoMasked ?? "****"} · {merchantProfile.payoutBankCode ?? "—"}
                </p>
              ) : null}
            </SurfaceCard>
          </div>
        ) : null}

        {tab === "products" ? (
          <SurfaceCard style={{ padding: "1rem" }}>
            <h2 style={{ marginTop: 0 }}>Products</h2>
            <div style={{ display: "grid", gap: 8 }}>
              {products.map((product) => (
                <article key={product.id} className="surface-card" style={{ padding: "0.75rem" }}>
                  <strong>{product.name}</strong>
                  <p style={{ margin: "0.25rem 0", color: "var(--ui-muted)" }}>
                    {product.category?.name ?? "General"} - NGN {product.priceNgn.toLocaleString()} - Stock {product.stock}
                  </p>
                  <small style={{ color: "var(--ui-muted)" }}>Status: {product.approvalStatus}</small>
                </article>
              ))}
            </div>
          </SurfaceCard>
        ) : null}

        {tab === "orders" ? (
          <SurfaceCard style={{ padding: "1rem" }}>
            <h2 style={{ marginTop: 0 }}>Orders</h2>
            {orders.length === 0 ? <p style={{ color: "var(--ui-muted)" }}>No orders yet.</p> : null}
            {orders.map((line) => (
              <article key={`${line.order.id}-${line.product.name}`} className="surface-card" style={{ padding: "0.75rem", marginBottom: 8 }}>
                <strong>{line.product.name}</strong>
                <p style={{ margin: "0.3rem 0", color: "var(--ui-muted)" }}>
                  {line.order.recipientName} - Qty {line.quantity} - NGN {line.lineTotalNgn.toLocaleString()}
                </p>
                <small style={{ color: "var(--ui-muted)" }}>Order status: {line.order.status}</small>
              </article>
            ))}
          </SurfaceCard>
        ) : null}

        {tab === "reviews" ? (
          <SurfaceCard style={{ padding: "1rem" }}>
            <h2 style={{ marginTop: 0 }}>Reviews</h2>
            <StarRow rating={analytics.averageRating} count={reviews.length} />
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {reviews.map((review) => (
                <article key={review.id} className="surface-card" style={{ padding: "0.75rem" }}>
                  <strong>{review.product.name}</strong>
                  <p style={{ margin: "0.3rem 0" }}>{review.comment}</p>
                  <small style={{ color: "var(--ui-muted)" }}>
                    {"★".repeat(review.rating)} by {review.user.firstName} {review.user.lastName}
                  </small>
                </article>
              ))}
            </div>
          </SurfaceCard>
        ) : null}

        {tab === "analytics" ? (
          <section style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
            <MetricTile label="Gross sales" value={`NGN ${analytics.grossSales.toLocaleString()}`} meta="From order lines" />
            <MetricTile label="Product views" value={analytics.viewsEstimate.toLocaleString()} meta="Estimated buyer exposure" />
            <MetricTile label="Searches" value={analytics.searchesEstimate.toLocaleString()} meta="Estimated search discoveries" />
            <MetricTile label="Average rating" value={analytics.averageRating.toFixed(1)} meta="From buyer reviews" />
          </section>
        ) : null}
        {tab === "support" ? (
          <div className="route-grid" style={{ gap: 10 }}>
            <SurfaceCard style={{ padding: "1rem" }}>
              <h2 style={{ marginTop: 0 }}>Customer support</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                Send complaints about orders, transactions, or any merchant issue directly to admin support.
              </p>
              <div className="merchant-auth-two-col">
                <div className="field">
                  <label>Category</label>
                  <select className="text-input" value={supportCategory} onChange={(e) => setSupportCategory(e.target.value as typeof supportCategory)}>
                    <option value="GENERAL">General</option>
                    <option value="ORDER">Order</option>
                    <option value="PRODUCT">Product</option>
                    <option value="TRANSACTION">Transaction</option>
                    <option value="ACCOUNT">Account</option>
                  </select>
                </div>
                <div className="field">
                  <label>{supportReferenceLabel}</label>
                  <input className="text-input" value={supportOrderId} onChange={(e) => setSupportOrderId(e.target.value)} />
                </div>
                <div className="field merchant-span-full">
                  <label>Subject</label>
                  <input className="text-input" value={supportSubject} onChange={(e) => setSupportSubject(e.target.value)} />
                </div>
                <div className="field merchant-span-full">
                  <label>Message</label>
                  <textarea className="text-input" rows={5} value={supportMessage} onChange={(e) => setSupportMessage(e.target.value)} />
                </div>
              </div>
              <ActionButton
                isLoading={supportSubmitting}
                loadingText="Sending…"
                onClick={() => void submitSupportMessage()}
              >
                Send message to admin
              </ActionButton>
            </SurfaceCard>
            <SurfaceCard style={{ padding: "1rem" }}>
              <h3 style={{ marginTop: 0 }}>Recent messages</h3>
              {supportRows.length === 0 ? <p className="muted">No support messages yet.</p> : null}
              <div style={{ display: "grid", gap: 8 }}>
                {supportRows.map((ticket) => (
                  <article key={ticket.id} className="surface-card" style={{ padding: "0.75rem" }}>
                    <strong>{ticket.subject}</strong>
                    <p className="muted" style={{ margin: "6px 0" }}>
                      {ticket.category} · {ticket.status} · {new Date(ticket.createdAt).toLocaleString()}
                    </p>
                    <small style={{ color: "var(--ui-muted)" }}>Ticket #{ticket.id.slice(0, 10)}</small>
                  </article>
                ))}
              </div>
            </SurfaceCard>
          </div>
        ) : null}

        {loadError ? <p style={{ color: "var(--ui-danger)" }}>{loadError}</p> : null}
        {merchantProfile ? (
          <p className="muted" style={{ fontSize: "0.85rem", marginTop: -6 }}>
            Merchant {merchantProfile.businessName} · Verification {merchantProfile.verificationStatus} · Status {merchantProfile.status}
          </p>
        ) : null}
        </>
        ) : null}
      </main>
    </>
  );
}
