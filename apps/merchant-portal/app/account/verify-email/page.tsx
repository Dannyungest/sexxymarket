import { Suspense } from "react";
import { VerifyMerchantEmailClient } from "./verify-merchant-email-client";

export default function MerchantVerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="app-shell" style={{ padding: "3rem", textAlign: "center" }}>
          Loading...
        </main>
      }
    >
      <VerifyMerchantEmailClient />
    </Suspense>
  );
}
