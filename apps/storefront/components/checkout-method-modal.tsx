"use client";

import { useRouter } from "next/navigation";
import { ActionButton, SurfaceCard } from "@sexxymarket/ui";
import { LogIn, UserPlus, X } from "lucide-react";

type CheckoutMethodModalProps = {
  open: boolean;
  onClose: () => void;
};

const CHECKOUT_PATH = "/checkout";
const CHECKOUT_GUEST = "/checkout?method=guest";
const RETURN_PARAM = (path: string) => `returnUrl=${encodeURIComponent(path)}`;

/**
 * Shown from the cart when the shopper is not signed in — pick guest vs account
 * (account path sends them through login, then back to checkout).
 */
export function CheckoutMethodModal({ open, onClose }: CheckoutMethodModalProps) {
  const router = useRouter();
  if (!open) return null;

  return (
    <div className="checkout-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="checkout-method-title">
      <SurfaceCard
        className="checkout-modal-panel"
        style={{
          maxWidth: 480,
          width: "100%",
          padding: "1.25rem 1.35rem",
          position: "relative",
        }}
      >
        <button
          type="button"
          className="checkout-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <p className="route-eyebrow" style={{ margin: 0 }}>
          How would you like to check out?
        </p>
        <h2 id="checkout-method-title" className="section-title" style={{ margin: "0.4rem 0 0.45rem" }}>
          Continue securely
        </h2>
        <p className="section-lead" style={{ margin: "0 0 1rem" }}>
          Guest checkout is the fastest. Sign in to use saved delivery details and your account email for receipts.
        </p>
        <div className="checkout-method-actions">
          <ActionButton
            type="button"
            onClick={() => {
              onClose();
              router.push(CHECKOUT_GUEST);
            }}
          >
            Continue as guest
          </ActionButton>
          <ActionButton
            type="button"
            ghost
            onClick={() => {
              onClose();
              const account = `/account?${RETURN_PARAM(CHECKOUT_PATH)}`;
              router.push(account);
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <LogIn size={16} />
              Sign in
            </span>
          </ActionButton>
        </div>
        <p style={{ margin: "0.9rem 0 0", fontSize: "0.85rem", color: "var(--ui-muted)" }}>
          New here? You can create an account from the sign in page, then you will return to checkout.{" "}
        </p>
        <div style={{ marginTop: 6 }}>
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <ActionButton
              type="button"
              ghost
              onClick={() => {
                onClose();
                const account = `/account?${RETURN_PARAM(CHECKOUT_PATH)}&register=1`;
                router.push(account);
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <UserPlus size={16} />
                Create an account
              </span>
            </ActionButton>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
