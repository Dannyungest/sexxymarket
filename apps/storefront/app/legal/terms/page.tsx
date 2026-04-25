import { SurfaceCard } from "@sexxymarket/ui";
import { StorefrontShell } from "../../../components/storefront-shell";

export default function TermsPage() {
  return (
    <StorefrontShell>
      <section className="legal-wrap">
        <SurfaceCard className="legal-card">
          <p className="route-eyebrow" style={{ margin: 0 }}>Legal</p>
          <h1 className="section-title" style={{ marginTop: 4 }}>Terms of Use</h1>
          <p className="section-lead">Last updated: April 22, 2026</p>
          <p className="legal-top">
            These terms govern access to and use of Sexxy Market by customers, merchants, and guests.
          </p>
        </SurfaceCard>
        <SurfaceCard className="legal-card">
          <div className="legal-section">
            <h2>Eligibility and account obligations</h2>
            <ul className="legal-list">
              <li>You must be at least 18 years old to use this platform.</li>
              <li>You are responsible for keeping account credentials secure and accurate.</li>
              <li>False identity, payment abuse, or prohibited usage can result in account restriction.</li>
            </ul>
          </div>
          <div className="legal-section">
            <h2>Orders, pricing, and payments</h2>
            <ul className="legal-list">
              <li>All orders are subject to stock availability, merchant approval, and payment validation.</li>
              <li>Displayed prices are in NGN and may be updated before checkout confirmation.</li>
              <li>Orders may be canceled or flagged if fraud or legal violations are detected.</li>
            </ul>
          </div>
          <div className="legal-section">
            <h2>Shipping, delivery times, and cancellations</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              We aim to complete delivery within a target window of <strong>seven (7) days</strong> from the relevant
              dispatch point, subject to product availability, verification, and carrier performance. In exceptional
              cases—such as remote areas, public holidays, weather, or supply constraints—fulfillment may require up
              to a <strong>maximum of fourteen (14) days</strong> from our acceptance of the order, unless a longer
              period is required by law or expressly agreed. Delivery timelines shown at checkout are estimates, not
              guaranteed dates. Cancellations are processed according to order status, payment state, and our
              {" "}
              <a href="/legal/refund" className="subtle-link" style={{ textDecoration: "underline" }}>
                refund policy
              </a>
              .
            </p>
          </div>
          <div className="legal-section">
            <h2>Platform conduct and enforcement</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              Users must comply with applicable laws and platform standards. We may suspend content, transactions, or
              accounts that violate policy, pose safety risk, or undermine marketplace integrity.
            </p>
          </div>
          <div className="legal-section">
            <h2>Liability and governing law</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              Sexxy Market provides marketplace services with commercially reasonable safeguards but cannot guarantee
              uninterrupted availability in all circumstances. These terms are governed by applicable laws in Nigeria.
            </p>
          </div>
        </SurfaceCard>
      </section>
    </StorefrontShell>
  );
}
