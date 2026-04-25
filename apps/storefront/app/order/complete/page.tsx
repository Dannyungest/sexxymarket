import { Suspense } from "react";
import { SurfaceCard } from "@sexxymarket/ui";
import { StorefrontShell } from "../../../components/storefront-shell";
import { OrderCompleteContent } from "./order-complete-content";

export default function OrderCompletePage() {
  return (
    <Suspense
      fallback={
        <StorefrontShell>
          <div className="app-shell">
            <SurfaceCard className="route-card" style={{ padding: "1.5rem" }}>
              Loading…
            </SurfaceCard>
          </div>
        </StorefrontShell>
      }
    >
      <OrderCompleteContent />
    </Suspense>
  );
}
