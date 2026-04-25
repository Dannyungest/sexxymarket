"use client";

import Link from "next/link";
import { ActionButton, SurfaceCard } from "@sexxymarket/ui";

export type MerchantGateKind = "awaiting_approval" | "needs_verification";

export function MerchantVerificationGateModal({
  kind,
  onClose,
}: {
  kind: MerchantGateKind;
  onClose: () => void;
}) {
  if (kind === "awaiting_approval") {
    return (
      <SurfaceCard style={{ padding: "0.95rem" }}>
        <p className="route-eyebrow" style={{ margin: 0 }}>
          Application pending
        </p>
        <h3 style={{ margin: "6px 0" }}>Your application is still pending approval</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          You can review what you submitted or make updates while our team reviews your application. Product and order tools
          stay locked until you are approved.
        </p>
        <div className="actions-row" style={{ flexWrap: "wrap" }}>
          <Link href="/verify" style={{ textDecoration: "none" }}>
            <ActionButton>Review or edit application</ActionButton>
          </Link>
          <ActionButton ghost onClick={onClose}>
            Close
          </ActionButton>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard style={{ padding: "0.95rem" }}>
      <p className="route-eyebrow" style={{ margin: 0 }}>
        Verification required
      </p>
      <h3 style={{ margin: "6px 0" }}>Verify your merchant account first</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Complete verification to unlock product tools, orders, and analytics.
      </p>
      <div className="actions-row" style={{ flexWrap: "wrap" }}>
        <Link href="/verify" style={{ textDecoration: "none" }}>
          <ActionButton>Go to verification</ActionButton>
        </Link>
        <ActionButton ghost onClick={onClose}>
          Close
        </ActionButton>
      </div>
    </SurfaceCard>
  );
}
