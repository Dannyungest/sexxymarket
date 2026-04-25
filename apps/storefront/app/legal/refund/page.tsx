import { SurfaceCard } from "@sexxymarket/ui";
import { StorefrontShell } from "../../../components/storefront-shell";

export default function RefundPolicyPage() {
  return (
    <StorefrontShell>
      <section className="legal-wrap">
        <SurfaceCard className="legal-card">
          <p className="route-eyebrow" style={{ margin: 0 }}>Legal</p>
          <h1 className="section-title" style={{ marginTop: 4 }}>Refund &amp; returns policy</h1>
          <p className="section-lead">Last updated: April 24, 2026</p>
          <p className="legal-top">
            This policy sets out when and how refunds or other remedies may be offered for purchases made through
            Sexxy Market. It is designed to be fair, transparent, and aligned with common e-commerce practice. By
            completing checkout, you confirm that you have had the opportunity to read this policy and the{" "}
            <a href="/legal/terms" className="subtle-link" style={{ textDecoration: "underline" }}>
              Terms of use
            </a>
            .
          </p>
        </SurfaceCard>
        <SurfaceCard className="legal-card">
          <div className="legal-section">
            <h2>1. Scope</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              This policy applies to customers who place orders on the Sexxy Market storefront. Individual merchants
              ship physical goods; Sexxy Market provides the platform, order routing, and payment connection. Where
              a manufacturer’s warranty or merchant-specific terms apply, they are in addition to—and not a replacement
              for—this policy, except where the law requires otherwise.
            </p>
          </div>
          <div className="legal-section">
            <h2>2. Refund requests before dispatch</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              If you ask to cancel an order <strong>before</strong> it has been handed to a carrier and while our
              systems still allow cancellation, we will aim to void or refund the payment in line with the payment
              provider’s rules. You may be asked for your order reference and the email used at checkout. Refund timing
              to your card or account depends on your bank and the payment network (often several business days after we
              submit the refund).
            </p>
          </div>
          <div className="legal-section">
            <h2>3. Defective, damaged, or incorrect items</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              If you receive an item that is <strong>materially damaged</strong>, <strong>not as described</strong> on
              the product page at the time of purchase, or <strong>incorrect</strong> (wrong product or variant), contact
              support as soon as possible, ideally within <strong>48 hours</strong> of delivery, with your order
              reference and clear photos. We or the merchant will review the case and, where the claim is validated,
              may offer a replacement, store credit, or partial or full refund, at our or the merchant’s reasonable
              discretion. Items that show damage from misuse, abnormal use, or after the packaging has been opened in a
              way that affects resale may not qualify.
            </p>
          </div>
          <div className="legal-section">
            <h2>4. Change of mind and hygiene-sensitive products</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              For health, safety, and hygiene reasons, many products in the intimate wellness category may not be
              returnable once opened or where the seal is broken, in line with applicable consumer rules. If you change
              your mind on an <strong>unopened</strong> item in resalable condition, you may request a return within
              a short window (often <strong>7 days</strong> of delivery) where the product type and law allow. Return
              shipping, if applicable, may be at your cost unless the order was our error. Final eligibility is
              confirmed on a case-by-case basis.
            </p>
          </div>
          <div className="legal-section">
            <h2>5. Non-delivery and significant delay</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              If tracking shows no meaningful progress, or a delivery is significantly later than the estimates given at
              checkout, contact support with your order reference. We will investigate with the carrier and
              merchant. If the order cannot be fulfilled, a refund of the product value (and any delivery fee you paid
              to us, if applicable) may be offered in line with the situation and payment rules.
            </p>
          </div>
          <div className="legal-section">
            <h2>6. How to request a refund or return</h2>
            <ul className="legal-list">
              <li>Use the email address used for the order and include the order or transaction reference.</li>
              <li>Describe the issue clearly and attach photos where relevant.</li>
              <li>Do not dispose of the item until you are instructed, in case it needs to be returned for inspection.</li>
            </ul>
            <p style={{ margin: "8px 0 0", color: "var(--ui-muted)" }}>
              Our support team will respond using the contact details published in the product or order communications.
              We may need to verify your identity to protect your account and payment data.
            </p>
          </div>
          <div className="legal-section">
            <h2>7. Chargebacks and payment disputes</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              We encourage you to contact us before initiating a card chargeback, so we can try to resolve the issue
              quickly. Unfounded or duplicate chargebacks may complicate your account and order history. Payment
              providers make the final decision on bank-side disputes.
            </p>
          </div>
          <div className="legal-section">
            <h2>8. Changes to this policy</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              We may update this policy to reflect legal, operational, or product changes. The “Last updated” date at
              the top will change when we do. Continued use of the service after changes constitutes notice of the
              updated policy for new orders; existing orders remain governed by the version in effect at purchase
              where the law says so.
            </p>
          </div>
        </SurfaceCard>
      </section>
    </StorefrontShell>
  );
}
