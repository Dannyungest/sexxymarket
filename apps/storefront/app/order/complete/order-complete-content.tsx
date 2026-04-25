"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActionButton, SurfaceCard } from "@sexxymarket/ui";
import { AlertCircle, CheckCircle2, Loader2, Package } from "lucide-react";
import { StorefrontShell } from "../../../components/storefront-shell";
import { useStorefront } from "../../../components/storefront-provider";
import { getOrderReceiptByTxRef, type PublicOrderReceipt } from "../../../lib/storefront-api";

const POLL_MS = 2000;
const POLL_MAX = 28;

function inferTxRef(search: URLSearchParams) {
  return (search.get("tx_ref") || search.get("txRef") || search.get("txref") || "").trim();
}

function statusLooksFailed(s: string | null) {
  if (!s) return false;
  const u = s.toLowerCase();
  return u === "failed" || u === "error" || u === "cancelled" || u === "canceled";
}

function statusLooksSuccess(s: string | null) {
  if (!s) return true;
  const u = s.toLowerCase();
  return u === "successful" || u === "success" || u === "completed";
}

export function OrderCompleteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clearCart } = useStorefront();
  const clearedRef = useRef(false);
  const [receipt, setReceipt] = useState<PublicOrderReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polled, setPolled] = useState(0);
  const [loading, setLoading] = useState(true);
  const txRef = inferTxRef(searchParams);
  const gatewayStatus = searchParams.get("status");
  const paymentFailed = statusLooksFailed(gatewayStatus);

  const load = useCallback(async () => {
    if (!txRef) {
      setError("Missing payment reference. Open this page from the payment return link, or check your email for your receipt.");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const r = await getOrderReceiptByTxRef(txRef);
      setReceipt(r);
      if (r.status === "PAID" && !clearedRef.current) {
        clearedRef.current = true;
        clearCart();
      }
    } catch {
      setError("We could not load this order. The link may be invalid or expired.");
      setReceipt(null);
    } finally {
      setLoading(false);
    }
  }, [txRef, clearCart]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  useEffect(() => {
    if (paymentFailed || !txRef || !receipt || receipt.status === "PAID" || !statusLooksSuccess(gatewayStatus)) {
      return;
    }
    if (polled >= POLL_MAX) return;
    const t = window.setTimeout(() => {
      setPolled((p) => p + 1);
      setLoading(true);
      void getOrderReceiptByTxRef(txRef)
        .then((r) => {
          setReceipt(r);
          if (r.status === "PAID" && !clearedRef.current) {
            clearedRef.current = true;
            clearCart();
          }
        })
        .catch(() => {
          /* keep showing pending */
        })
        .finally(() => setLoading(false));
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [paymentFailed, txRef, receipt, gatewayStatus, polled, clearCart]);

  if (!txRef) {
    return (
      <StorefrontShell>
        <div className="app-shell" style={{ maxWidth: 720, margin: "0 auto" }}>
          <div className="checkout-alert checkout-alert--error" role="alert" style={{ marginTop: 12 }}>
            {error}
          </div>
          <p style={{ marginTop: 12 }}>
            <Link href="/" className="subtle-link">
              Back to shop
            </Link>
          </p>
        </div>
      </StorefrontShell>
    );
  }

  if (paymentFailed) {
    return (
      <StorefrontShell>
        <div className="app-shell" style={{ maxWidth: 720, margin: "0 auto" }}>
          <SurfaceCard className="route-card" style={{ marginTop: 12 }}>
            <p className="route-eyebrow" style={{ margin: 0 }}>
              Payment
            </p>
            <h1 className="section-title" style={{ marginTop: 6 }}>
              Payment not completed
            </h1>
            <p className="section-lead">
              The payment was not successful or was cancelled. You can return to your cart to try again. Your order may
              still be open as unpaid.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <ActionButton type="button" onClick={() => router.push("/cart")}>
                Return to cart
              </ActionButton>
              <ActionButton type="button" ghost onClick={() => router.push("/")}>
                Continue shopping
              </ActionButton>
            </div>
          </SurfaceCard>
        </div>
      </StorefrontShell>
    );
  }

  if (loading && !receipt) {
    return (
      <StorefrontShell>
        <div className="app-shell" style={{ maxWidth: 720, margin: "0 auto", padding: "2rem" }}>
          <p style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--ui-muted)" }}>
            <Loader2
              size={20}
              style={{ animation: "ui-spin 0.8s linear infinite" }}
            />
            Loading your order…
          </p>
        </div>
      </StorefrontShell>
    );
  }

  if (error && !receipt) {
    return (
      <StorefrontShell>
        <div className="app-shell" style={{ maxWidth: 720, margin: "0 auto" }}>
          <div className="checkout-alert checkout-alert--error" role="alert" style={{ marginTop: 12 }}>
            {error}
          </div>
        </div>
      </StorefrontShell>
    );
  }

  if (!receipt) return null;

  if (receipt.status === "PENDING" && polled < POLL_MAX) {
    return (
      <StorefrontShell>
        <div className="app-shell" style={{ maxWidth: 720, margin: "0 auto" }}>
          <SurfaceCard className="route-card" style={{ marginTop: 12 }}>
            <h1 className="section-title" style={{ marginTop: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Loader2
                size={24}
                style={{ animation: "ui-spin 0.8s linear infinite" }}
              />
              Confirming your payment
            </h1>
            <p className="section-lead">
              Almost there — we are confirming with your bank. This page will refresh in a few seconds. You can also
              check your email shortly for your receipt.
            </p>
          </SurfaceCard>
        </div>
      </StorefrontShell>
    );
  }

  if (receipt.status === "PENDING" && polled >= POLL_MAX) {
    return (
      <StorefrontShell>
        <div className="app-shell" style={{ maxWidth: 720, margin: "0 auto" }}>
          <SurfaceCard className="route-card" style={{ marginTop: 12 }}>
            <h1 className="section-title" style={{ marginTop: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={24} color="var(--ui-accent-strong)" />
              Still confirming
            </h1>
            <p className="section-lead">
              We have not been able to confirm your payment on this page yet. If the charge succeeded, you will receive
              a confirmation email. Contact support with your order reference: <strong>{receipt.id}</strong>
            </p>
            <div style={{ marginTop: 8 }}>
              <ActionButton type="button" onClick={() => router.push("/")}>
                Continue shopping
              </ActionButton>
            </div>
          </SurfaceCard>
        </div>
      </StorefrontShell>
    );
  }

  if (receipt.status !== "PAID") {
    return (
      <StorefrontShell>
        <div className="app-shell" style={{ maxWidth: 720, margin: "0 auto" }}>
          <div className="checkout-alert checkout-alert--error" role="alert" style={{ marginTop: 12 }}>
            This order is not paid yet. Status: {receipt.status}
          </div>
        </div>
      </StorefrontShell>
    );
  }

  return (
    <StorefrontShell>
      <div className="app-shell checkout-grid" style={{ maxWidth: 1000, margin: "0 auto" }}>
        <SurfaceCard className="route-card">
          <p className="route-eyebrow" style={{ margin: 0, color: "var(--ui-success)" }}>
            <CheckCircle2 size={14} style={{ verticalAlign: "text-top", display: "inline" }} /> Payment successful
          </p>
          <h1 className="section-title" style={{ marginTop: 4 }}>
            Thank you, {receipt.recipientName.split(" ")[0] || "valued customer"}
          </h1>
          <p className="section-lead" style={{ marginTop: 6 }}>
            Your order is paid. A detailed receipt with the same line items was sent to your email. You can also save
            or print this page.
          </p>
          <div
            className="surface-card"
            style={{ marginTop: 14, padding: "0.9rem 1rem", background: "var(--ui-card-soft)" }}
          >
            <p style={{ margin: 0, fontSize: "0.9rem" }}>
              <strong>Order ID</strong> {receipt.id}
            </p>
            {receipt.trackingNumber ? (
              <p style={{ margin: "6px 0 0", fontSize: "0.9rem" }}>
                <strong>Tracking</strong> {receipt.trackingNumber}
              </p>
            ) : null}
            <p style={{ margin: "6px 0 0", fontSize: "0.9rem", color: "var(--ui-muted)" }}>
              Placed {new Date(receipt.createdAt).toLocaleString()}
            </p>
          </div>
          <h2 className="section-title" style={{ margin: "1rem 0 0.5rem", fontSize: "1.15rem" }}>
            Items
          </h2>
          {receipt.items.map((item, i) => (
            <article key={i} className="surface-card" style={{ marginBottom: 8 }}>
              <div className="line-item">
                <Image
                  src={item.imageUrl || "/sexxymarketlogo.png"}
                  alt={item.name}
                  width={72}
                  height={72}
                  className="line-item-thumb"
                  unoptimized
                />
                <div>
                  <strong>{item.name}</strong>
                  {item.variantLabel ? (
                    <p style={{ margin: "0.25rem 0", color: "var(--ui-muted)", fontSize: "0.88rem" }}>{item.variantLabel}</p>
                  ) : null}
                  <p style={{ margin: "0.2rem 0", color: "var(--ui-muted)" }}>
                    Qty {item.quantity} – NGN {item.lineTotalNgn.toLocaleString()}
                  </p>
                </div>
                <div />
                <strong>NGN {item.lineTotalNgn.toLocaleString()}</strong>
              </div>
            </article>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--ui-border)" }}>
            <span>Subtotal</span>
            <span>NGN {receipt.subtotalNgn.toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Delivery</span>
            <span>NGN {receipt.deliveryFeeNgn.toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "1.1rem" }}>
            <span>Total paid</span>
            <span>NGN {receipt.totalNgn.toLocaleString()}</span>
          </div>
        </SurfaceCard>
        <SurfaceCard className="route-card">
          <h2 className="section-title" style={{ marginTop: 0, fontSize: "1.15rem", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Package size={20} />
            Delivery
          </h2>
          <p style={{ margin: "0.5rem 0", lineHeight: 1.5 }}>
            <strong>{receipt.recipientName}</strong>
            <br />
            {receipt.recipientPhone}
            <br />
            {receipt.shippingAddress}
            <br />
            {receipt.shippingCity}, {receipt.shippingState}
          </p>
          <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
            <ActionButton type="button" onClick={() => router.push("/")}>
              Continue shopping
            </ActionButton>
            <Link href="/account" className="subtle-link" style={{ fontSize: "0.95rem" }}>
              View account & orders
            </Link>
          </div>
        </SurfaceCard>
      </div>
    </StorefrontShell>
  );
}
