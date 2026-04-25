import { Suspense } from "react";
import { SurfaceCard } from "@sexxymarket/ui";
import { StorefrontShell } from "../../components/storefront-shell";
import { CheckoutContent } from "./checkout-content";

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <StorefrontShell>
          <div className="app-shell">
            <SurfaceCard className="route-card" style={{ padding: "1.5rem" }}>
              Loading checkout…
            </SurfaceCard>
          </div>
        </StorefrontShell>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
