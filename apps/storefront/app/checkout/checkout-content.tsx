"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { ActionButton, ProductCodePill, SurfaceCard } from "@sexxymarket/ui";
import { BookmarkPlus, CheckCircle2, CreditCard, LogIn, Package, Truck, User, Users } from "lucide-react";
import { StorefrontShell } from "../../components/storefront-shell";
import { useStorefront } from "../../components/storefront-provider";
import { resolveProductCode } from "../../lib/product-code";
import { createOrder, createSavedRecipient, deleteSavedRecipient, getMe, listSavedRecipients, type SavedRecipient } from "../../lib/storefront-api";
import { useAuthSession } from "../../lib/use-auth-session";
import { DELIVERY_ESTIMATE_SHORT } from "../../lib/delivery-copy";

const NIGERIA_GEO_DATA_URL =
  "https://gist.githubusercontent.com/devhammed/0bb9eeac9ff22c895100d072f489dc98/raw";
const CHECKOUT_PATH = "/checkout";
const RETURN_TO_CHECKOUT = `/account?returnUrl=${encodeURIComponent(CHECKOUT_PATH)}`;

type StateLgaRow = { state: string; lgas: string[] };

function applySavedToForm(
  s: SavedRecipient,
  setters: {
    setRecipientName: (v: string) => void;
    setRecipientPhone: (v: string) => void;
    setShippingHouseNo: (v: string) => void;
    setShippingStreet: (v: string) => void;
    setShippingLandmark: (v: string) => void;
    setShippingState: (v: string) => void;
    setShippingLga: (v: string) => void;
    setShippingCity: (v: string) => void;
  },
) {
  setters.setRecipientName(s.recipientName);
  setters.setRecipientPhone(s.recipientPhone);
  setters.setShippingHouseNo(s.houseNo);
  setters.setShippingStreet(s.street);
  setters.setShippingLandmark(s.landmark);
  setters.setShippingState(s.shippingState);
  setters.setShippingLga(s.shippingLga);
  setters.setShippingCity(s.shippingCity);
}

export function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const methodGuest = searchParams.get("method") === "guest";
  const { session, loading: sessionLoading, refresh: refreshSession } = useAuthSession();
  const { cart, cartTotal } = useStorefront();
  const cartLines = useMemo(() => Object.values(cart), [cart]);
  const unitPrice = (line: (typeof cartLines)[number]) =>
    line.product.priceNgn +
    (line.selectedVariantId
      ? (line.product.variants?.find((variant) => variant.id === line.selectedVariantId)?.extraPriceNgn ?? 0)
      : 0);

  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [shippingHouseNo, setShippingHouseNo] = useState("");
  const [shippingStreet, setShippingStreet] = useState("");
  const [shippingLandmark, setShippingLandmark] = useState("");
  const [shippingState, setShippingState] = useState("");
  const [shippingLga, setShippingLga] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [stateLgaRows, setStateLgaRows] = useState<StateLgaRow[]>([]);
  const [guestEmail, setGuestEmail] = useState("");
  const [orderAlert, setOrderAlert] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [addressAlert, setAddressAlert] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [agreedToPolicies, setAgreedToPolicies] = useState(false);
  const [saveForLater, setSaveForLater] = useState(false);
  const [saveAddressLabel, setSaveAddressLabel] = useState("");
  const [savedList, setSavedList] = useState<SavedRecipient[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [selectedSavedId, setSelectedSavedId] = useState<"new" | string>("new");

  const isAccountCheckout = !!session;
  const showGuestOrSignIn = !isAccountCheckout;
  const showMethodGate = showGuestOrSignIn && !methodGuest;

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
    if (!session?.token) {
      const id = window.setTimeout(() => setSavedList([]), 0);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => {
      setSavedLoading(true);
      void listSavedRecipients(session.token)
        .then((list) => setSavedList(list))
        .catch(() => setSavedList([]))
        .finally(() => setSavedLoading(false));
    }, 0);
    return () => window.clearTimeout(id);
  }, [session?.token]);

  const checkout = async () => {
    if (!agreedToPolicies) {
      setOrderAlert({ type: "error", text: "Please confirm you have read and agree to the Terms, Privacy Policy, and Refund Policy to continue." });
      return;
    }
    const needsGuestEmail = !isAccountCheckout;
    if (
      !cartLines.length ||
      !recipientName ||
      !recipientPhone ||
      !shippingHouseNo ||
      !shippingStreet ||
      !shippingState ||
      !shippingLga ||
      !shippingCity ||
      (needsGuestEmail && !guestEmail.trim())
    ) {
      setOrderAlert({ type: "error", text: "Complete all required delivery fields to continue." });
      return;
    }
    if (isAccountCheckout) {
      if (session?.mustChangePassword) {
        setOrderAlert({ type: "error", text: "Please set a new password in your account before checking out with your profile." });
        return;
      }
      if (!session?.emailVerified) {
        setOrderAlert({
          type: "error",
          text: "Please verify your email in your account before we can link this order, or go back and check out as a guest with an email you can access.",
        });
        return;
      }
    }

    flushSync(() => {
      setSubmitting(true);
    });
    setOrderAlert(null);
    setAddressAlert(null);

    let tokenForOrder: string | undefined;
    if (isAccountCheckout) {
      const raw = session?.token;
      if (!raw) {
        flushSync(() => setSubmitting(false));
        setOrderAlert({ type: "error", text: "Your session is no longer available. Please sign in again from your account page." });
        void refreshSession();
        return;
      }
      try {
        const me = await getMe(raw);
        if (!me.emailVerified) {
          flushSync(() => setSubmitting(false));
          setOrderAlert({ type: "error", text: "Please verify your email in your account before we can process your order." });
          return;
        }
        tokenForOrder = raw;
      } catch {
        flushSync(() => setSubmitting(false));
        setOrderAlert({ type: "error", text: "Your session is no longer valid. Please sign in again, or use guest checkout." });
        void refreshSession();
        return;
      }
    } else {
      tokenForOrder = undefined;
    }

    const shippingAddress = [
      `${shippingHouseNo.trim()} ${shippingStreet.trim()}`.trim(),
      shippingLga.trim(),
      shippingState.trim(),
      shippingLandmark.trim() ? `Landmark: ${shippingLandmark.trim()}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    const emailLine = isAccountCheckout && session ? session.email : guestEmail.trim();
    if (!emailLine) {
      flushSync(() => setSubmitting(false));
      setOrderAlert({ type: "error", text: "Email is required to start secure payment." });
      return;
    }
    try {
      const order = await createOrder(
        {
          items: cartLines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
            variantId: line.selectedVariantId,
          })),
          shippingAddress,
          shippingState,
          shippingCity,
          recipientName,
          recipientPhone,
          guestEmail: isAccountCheckout ? undefined : guestEmail.trim(),
          guestPhone: recipientPhone,
        },
        tokenForOrder,
      );
      if (isAccountCheckout && saveForLater && session?.token) {
        try {
          await createSavedRecipient(session.token, {
            label: saveAddressLabel.trim() || undefined,
            recipientName: recipientName.trim(),
            recipientPhone: recipientPhone.trim(),
            houseNo: shippingHouseNo.trim(),
            street: shippingStreet.trim(),
            landmark: shippingLandmark.trim() || undefined,
            shippingState: shippingState.trim(),
            shippingLga: shippingLga.trim(),
            shippingCity: shippingCity.trim(),
          });
          setAddressAlert(null);
          void listSavedRecipients(session.token).then((list) => setSavedList(list));
        } catch {
          setAddressAlert("The order is placed, but we could not save this address to your account. You can add it from your account or at your next checkout.");
        }
      }
      if (order.paymentLink) {
        window.location.assign(order.paymentLink);
        return;
      }
      setOrderAlert({ type: "error", text: "Could not start the payment page. Please try again or contact support." });
    } catch (e) {
      setOrderAlert({
        type: "error",
        text: e instanceof Error ? e.message : "Unable to create the order. Please check details and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const removeSelectedSaved = async () => {
    if (!session?.token || selectedSavedId === "new") return;
    if (!window.confirm("Remove this saved address from your account?")) return;
    try {
      await deleteSavedRecipient(session.token, selectedSavedId);
      setSelectedSavedId("new");
      setSavedList((p) => p.filter((r) => r.id !== selectedSavedId));
    } catch {
      setAddressAlert("Could not remove the saved address. Please try again.");
    }
  };

  const setters = useMemo(
    () => ({
      setRecipientName,
      setRecipientPhone,
      setShippingHouseNo,
      setShippingStreet,
      setShippingLandmark,
      setShippingState,
      setShippingLga,
      setShippingCity,
    }),
    [],
  );

  if (sessionLoading) {
    return (
      <StorefrontShell>
        <div className="app-shell">
          <SurfaceCard className="route-card" style={{ padding: "1.5rem" }}>
            Preparing secure checkout…
          </SurfaceCard>
        </div>
      </StorefrontShell>
    );
  }

  return (
    <StorefrontShell>
      <section className="checkout-grid">
        <SurfaceCard className="route-card" style={{ position: "relative" }}>
          <nav className="checkout-progress" aria-label="Checkout progress">
            <span className="checkout-progress-step">
              <a href="/cart" className="icon-inline" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span className="step-dot" aria-hidden>
                  <Package size={11} />
                </span>{" "}
                Review cart
              </a>
            </span>
            <span style={{ color: "var(--ui-border)" }} aria-hidden>
              ·
            </span>
            <span className="checkout-progress-step is-active" aria-current="step">
              <span className="step-dot" aria-hidden>
                2
              </span>{" "}
              {"Delivery & payment details"}
            </span>
            <span style={{ color: "var(--ui-border)" }} aria-hidden>
              ·
            </span>
            <span className="checkout-progress-step">
              <span className="step-dot" aria-hidden>
                3
              </span>{" "}
              Pay securely
            </span>
          </nav>

          <h1 className="section-title" style={{ marginTop: 0 }}>
            Checkout
          </h1>
          <p className="section-lead" style={{ marginTop: 4 }}>
            {isAccountCheckout
              ? "We will use your account email for the receipt. Enter where to deliver, then generate your payment link."
              : "Discreet delivery, secure payment, and a clear summary before you pay."}
          </p>
          {DELIVERY_ESTIMATE_SHORT ? (
            <p
              style={{
                margin: "0.4rem 0 0.75rem",
                fontSize: "0.86rem",
                color: "var(--ui-muted)",
                lineHeight: 1.5,
              }}
            >
              {DELIVERY_ESTIMATE_SHORT}
            </p>
          ) : null}

          {isAccountCheckout && session ? (
            <div className="checkout-account-strip">
              <div>
                <p style={{ margin: 0, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ui-muted)" }}>
                  Order email
                </p>
                <p style={{ margin: "0.2rem 0 0", fontWeight: 700, fontSize: "1.02rem" }}>{session.email}</p>
                <p style={{ margin: "0.35rem 0 0", fontSize: "0.86rem", color: "var(--ui-muted)" }}>
                  Receipts and order updates are sent to this address—no need to re-enter it here.
                </p>
                {session.mustChangePassword ? (
                  <p style={{ margin: "0.5rem 0 0", color: "var(--ui-danger)", fontSize: "0.88rem" }}>
                    You must <Link href={RETURN_TO_CHECKOUT}>set a new password in your account</Link> before checking out
                    on your profile.
                  </p>
                ) : null}
                {!session.emailVerified && !session.mustChangePassword ? (
                  <p style={{ margin: "0.5rem 0 0", color: "var(--ui-danger)", fontSize: "0.88rem" }}>
                    <Link href={RETURN_TO_CHECKOUT}>Verify your email in your account</Link> to link this order, or open a
                    new browser window and use guest checkout with a reachable email.
                  </p>
                ) : null}
              </div>
              <User size={28} color="var(--ui-accent-strong)" style={{ flexShrink: 0 }} />
            </div>
          ) : null}

          {showMethodGate ? (
            <div
              className="surface-card"
              style={{
                marginTop: 2,
                marginBottom: 14,
                padding: "0.9rem 1rem",
                border: "1px solid var(--ui-border)",
                borderRadius: 12,
                background: "color-mix(in srgb, var(--ui-card-soft) 88%, var(--ui-surface))",
              }}
            >
              <p style={{ margin: 0, fontWeight: 650, fontSize: "0.95rem" }}>How would you like to check out?</p>
              <p style={{ margin: "6px 0 0", color: "var(--ui-muted)", fontSize: "0.9rem" }}>
                Guest is fastest. Sign in to use your account email and save delivery details for next time.
              </p>
              <div
                className="checkout-method-actions"
                style={{ marginTop: 10 }}
              >
                <ActionButton
                  type="button"
                  onClick={() => {
                    router.push("/checkout?method=guest");
                  }}
                >
                  <span className="icon-inline" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Users size={16} />
                    Continue as guest
                  </span>
                </ActionButton>
                <ActionButton type="button" ghost onClick={() => router.push(RETURN_TO_CHECKOUT)}>
                  <span className="icon-inline" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <LogIn size={16} />
                    Sign in
                  </span>
                </ActionButton>
              </div>
            </div>
          ) : null}

          {showGuestOrSignIn && methodGuest && !isAccountCheckout ? (
            <p
              className="surface-card"
              style={{
                fontSize: "0.9rem",
                lineHeight: 1.5,
                padding: "0.7rem 0.85rem",
                marginBottom: 12,
                color: "var(--ui-muted)",
                border: "1px solid var(--ui-border)",
                borderRadius: 12,
              }}
            >
              <strong>Guest checkout.</strong> Need saved addresses or a linked order?{" "}
              <Link href={RETURN_TO_CHECKOUT} className="subtle-link" style={{ textDecoration: "underline" }}>
                Sign in
              </Link>{" "}
              first.
            </p>
          ) : null}

          {isAccountCheckout && session.emailVerified && !session.mustChangePassword && (
            <div className="field" style={{ marginTop: 4, marginBottom: 10 }}>
              <label htmlFor="saved-addresses">Use a saved address</label>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <select
                  id="saved-addresses"
                  className="text-input"
                  value={selectedSavedId}
                  disabled={savedLoading}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSelectedSavedId(v);
                    if (v === "new") return;
                    const row = savedList.find((r) => r.id === v);
                    if (row) applySavedToForm(row, setters);
                  }}
                >
                  <option value="new">Enter a new address</option>
                  {savedList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label ? `${r.label} – ` : ""}
                      {r.recipientName}, {r.shippingCity}
                    </option>
                  ))}
                </select>
                {selectedSavedId !== "new" ? (
                  <button
                    type="button"
                    className="chip"
                    onClick={() => void removeSelectedSaved()}
                    style={{ borderColor: "var(--ui-danger)", color: "var(--ui-danger)" }}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {showMethodGate ? null : (
            <>
          <div className="form-grid" style={{ marginTop: 2 }}>
            <div className="field" style={showGuestOrSignIn && !isAccountCheckout ? { gridColumn: "1 / -1" } : {}}>
              <label htmlFor="recipient-name">Full name (recipient) *</label>
              <input
                id="recipient-name"
                className="text-input"
                autoComplete="name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="recipient-phone">Recipient phone (NG) *</label>
              <input
                id="recipient-phone"
                className="text-input"
                inputMode="tel"
                autoComplete="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
              />
            </div>
            {!isAccountCheckout ? (
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="recipient-email">Email for order updates &amp; payment *</label>
                <input
                  id="recipient-email"
                  className="text-input"
                  type="email"
                  autoComplete="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                />
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="shipping-house-no">House no. *</label>
              <input
                id="shipping-house-no"
                className="text-input"
                value={shippingHouseNo}
                onChange={(e) => setShippingHouseNo(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="shipping-street">Street *</label>
              <input
                id="shipping-street"
                className="text-input"
                value={shippingStreet}
                onChange={(e) => setShippingStreet(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="shipping-city">City / town *</label>
              <input
                id="shipping-city"
                className="text-input"
                value={shippingCity}
                onChange={(e) => setShippingCity(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="shipping-state">State *</label>
              <select
                id="shipping-state"
                className="text-input"
                value={shippingState}
                onChange={(e) => {
                  setShippingState(e.target.value);
                  setShippingLga("");
                }}
              >
                <option value="">Select state</option>
                {stateLgaRows.map((row) => (
                  <option key={row.state} value={row.state}>
                    {row.state}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="shipping-lga">Local government *</label>
              <select
                id="shipping-lga"
                className="text-input"
                value={shippingLga}
                onChange={(e) => setShippingLga(e.target.value)}
              >
                <option value="">Select LGA</option>
                {(stateLgaRows.find((row) => row.state === shippingState)?.lgas ?? []).map((lga) => (
                  <option key={lga} value={lga}>
                    {lga}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="shipping-landmark">Closest landmark (optional)</label>
              <input
                id="shipping-landmark"
                className="text-input"
                value={shippingLandmark}
                onChange={(e) => setShippingLandmark(e.target.value)}
              />
            </div>
          </div>

          {isAccountCheckout && session.emailVerified && !session.mustChangePassword ? (
            <div
              className="surface-card"
              style={{
                marginTop: 12,
                padding: "0.85rem 1rem",
                border: "1px solid var(--ui-border)",
                borderRadius: 12,
                background: "var(--ui-card-soft)",
              }}
            >
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={saveForLater}
                  onChange={(e) => setSaveForLater(e.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span style={{ lineHeight: 1.5 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                    <BookmarkPlus size={16} color="var(--ui-accent-strong)" />
                    Save this address for your next order
                  </span>
                  <p style={{ margin: "0.3rem 0 0", fontSize: "0.88rem", color: "var(--ui-muted)" }}>
                    We store it in your account so you can pick it next time you check out.
                  </p>
                </span>
              </label>
              {saveForLater ? (
                <div className="field" style={{ marginTop: 10, marginBottom: 0, maxWidth: 320 }}>
                  <label htmlFor="save-addr-label">Address label (optional), e.g. &quot;Home&quot;, &quot;Mum – Lagos&quot;</label>
                  <input
                    id="save-addr-label"
                    className="text-input"
                    value={saveAddressLabel}
                    onChange={(e) => setSaveAddressLabel(e.target.value)}
                    placeholder="Home"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div
            className="surface-card"
            style={{
              marginTop: 14,
              padding: "0.85rem 1rem",
              border: "1px solid var(--ui-border)",
              borderRadius: 12,
            }}
          >
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: "0.9rem", lineHeight: 1.5 }}>
              <input
                type="checkbox"
                checked={agreedToPolicies}
                onChange={(e) => setAgreedToPolicies(e.target.checked)}
                style={{ marginTop: 4 }}
              />
              <span>
                I have read and agree to the{" "}
                <Link href="/legal/terms" target="_blank" rel="noreferrer" className="subtle-link" style={{ textDecoration: "underline" }}>
                  Terms of use
                </Link>
                , the{" "}
                <Link href="/legal/privacy" target="_blank" rel="noreferrer" className="subtle-link" style={{ textDecoration: "underline" }}>
                  Privacy policy
                </Link>
                , and the{" "}
                <Link href="/legal/refund" target="_blank" rel="noreferrer" className="subtle-link" style={{ textDecoration: "underline" }}>
                  Refund policy
                </Link>
                . I understand that delivery is estimated and may be affected by location and logistics, as described in
                those terms.
              </span>
            </label>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ActionButton
              isLoading={submitting}
              loadingText="Redirecting to secure payment…"
              onClick={() => void checkout()}
              disabled={submitting || cartLines.length === 0}
            >
              Continue to secure payment
            </ActionButton>
            <ActionButton type="button" ghost onClick={() => router.push("/cart")}>
              Back to cart
            </ActionButton>
          </div>
          {orderAlert ? (
            <div
              className={`checkout-alert ${
                orderAlert.type === "error" ? "checkout-alert--error" : "checkout-alert--success"
              }`}
              role={orderAlert.type === "error" ? "alert" : "status"}
            >
              {orderAlert.text}
            </div>
          ) : null}
          {addressAlert ? (
            <div className="checkout-alert checkout-alert--error" role="alert">
              {addressAlert}
            </div>
          ) : null}
          <p style={{ margin: "8px 0 0", color: "var(--ui-muted)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={14} /> You will be taken to our payment partner to pay. After a successful payment you will
            return here to your receipt, and a confirmation email is sent.
          </p>
            </>
          )}
        </SurfaceCard>

        <SurfaceCard className="route-card">
          <h2 className="section-title" style={{ marginTop: 0, fontSize: "1.2rem" }}>
            Order summary
          </h2>
          {cartLines.length === 0 ? <p style={{ color: "var(--ui-muted)" }}>Your cart is empty. Add something before you can pay.</p> : null}
          {cartLines.map((line) => (
            <article key={line.key} className="surface-card">
              <div className="line-item">
                <Image
                  src={line.product.images?.[0]?.imageUrl ?? "/sexxymarketlogo.PNG"}
                  alt={line.product.name}
                  width={72}
                  height={72}
                  className="line-item-thumb"
                  unoptimized
                />
                <div>
                  <strong>{line.product.name}</strong>
                  <div style={{ marginTop: 6 }}>
                    <ProductCodePill code={resolveProductCode(line.product, line.selectedVariantId)} />
                  </div>
                  <p style={{ margin: "0.3rem 0", color: "var(--ui-muted)" }}>
                    {line.selectedVariantId
                      ? line.product.variants?.find((variant) => variant.id === line.selectedVariantId)?.label
                      : "Default option"}
                  </p>
                  <p style={{ margin: "0.3rem 0", color: "var(--ui-muted)" }}>
                    Qty {line.quantity} - NGN {(line.quantity * unitPrice(line)).toLocaleString()}
                  </p>
                </div>
                <div />
                <strong style={{ textAlign: "right" }}>NGN {(line.quantity * unitPrice(line)).toLocaleString()}</strong>
              </div>
            </article>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--ui-border)" }}>
            <strong>Total</strong>
            <strong>NGN {cartTotal.toLocaleString()}</strong>
          </div>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <div className="pill">
              <Truck size={13} /> {DELIVERY_ESTIMATE_SHORT}
            </div>
            <div className="pill">
              <CreditCard size={13} /> Secure online payment
            </div>
          </div>
        </SurfaceCard>
      </section>
    </StorefrontShell>
  );
}
