import { Suspense } from "react";
import { VerifyEmailClient } from "./verify-email-client";

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-wrap" style={{ padding: "3rem", textAlign: "center" }}>
          Loading…
        </div>
      }
    >
      <VerifyEmailClient />
    </Suspense>
  );
}
