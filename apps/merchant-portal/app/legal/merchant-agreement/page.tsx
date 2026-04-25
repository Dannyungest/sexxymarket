export default function MerchantAgreementPage() {
  return (
    <main className="app-shell route-grid" style={{ maxWidth: 980, margin: "0 auto", paddingBottom: "1.5rem" }}>
      <section className="surface-card" style={{ padding: "1.2rem" }}>
        <p className="route-eyebrow" style={{ margin: 0 }}>Legal</p>
        <h1 className="section-title" style={{ marginTop: 4 }}>SexxyMarket Merchant Terms & Conditions</h1>
        <p className="section-lead" style={{ marginBottom: 0 }}>Last updated: April 24, 2026</p>
        <p className="muted" style={{ marginTop: 10, lineHeight: 1.7 }}>
          These Merchant Terms & Conditions ("Agreement") govern your onboarding, listing rights, fulfillment obligations,
          payment settlement, and compliance duties as a merchant on SexxyMarket. By applying, listing, or transacting
          through the platform, you accept this Agreement.
        </p>
      </section>

      <section className="surface-card route-grid" style={{ padding: "1.2rem", gap: 14 }}>
        <div>
          <h2 style={{ margin: "0 0 6px" }}>1. Eligibility and Merchant Representation</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            You represent that all submitted identity, business, and settlement information is accurate, complete, and
            lawful. You authorize SexxyMarket to perform risk, fraud, sanctions, and KYC/AML checks at onboarding and
            during the merchant lifecycle.
          </p>
        </div>

        <div>
          <h2 style={{ margin: "0 0 6px" }}>2. Verification, Review, and Ongoing Compliance</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            Merchant activation, listing visibility, and account standing are conditional upon verification outcomes and
            policy adherence. SexxyMarket may request refreshed documents, conduct physical verification where necessary,
            and pause, limit, or terminate access for policy or legal non-compliance.
          </p>
        </div>

        <div>
          <h2 style={{ margin: "0 0 6px" }}>3. Commercial Terms and Commission</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            Platform commission is <strong>5% of gross sales</strong> on completed and settled orders, unless a signed
            enterprise addendum states otherwise. Applicable taxes, chargebacks, refunds, reversals, dispute outcomes, and
            policy penalties may affect final settlement values.
          </p>
        </div>

        <div>
          <h2 style={{ margin: "0 0 6px" }}>4. Payout Settlement and Risk Holds</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            Settlements are released to the verified payout account after delivery confirmation and internal risk checks.
            SexxyMarket may place temporary holds where fraud, chargeback exposure, fulfillment disputes, or legal review
            is in progress. Settlement account details must remain valid and ownership-consistent at all times.
          </p>
        </div>

        <div>
          <h2 style={{ margin: "0 0 6px" }}>5. Listing Integrity and Product Governance</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            Merchants must maintain truthful titles, descriptions, media, variants, and fulfillment promises. Counterfeit,
            prohibited, unsafe, or misrepresented listings are strictly disallowed. SexxyMarket may unpublish, reject,
            rollback, or permanently remove listings that breach policy.
          </p>
        </div>

        <div>
          <h2 style={{ margin: "0 0 6px" }}>6. Delivery Standards and Customer Care</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            You are responsible for timely dispatch, accurate delivery updates, and commercially reasonable customer
            support. Failure to fulfill orders, repeated delay, or fraudulent delivery events may trigger account
            sanctions, withheld settlements, and further legal action.
          </p>
        </div>

        <div>
          <h2 style={{ margin: "0 0 6px" }}>7. Intellectual Property and Brand Use</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            You warrant rights to all images, marks, and product materials uploaded. Unauthorized use of third-party
            intellectual property may result in immediate takedown and account restrictions. SexxyMarket branding may not
            be used for external representation without written approval.
          </p>
        </div>

        <div>
          <h2 style={{ margin: "0 0 6px" }}>8. Enforcement, Suspension, and Termination</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            SexxyMarket may suspend, downgrade, limit, or terminate merchant access for legal, compliance, risk, or policy
            reasons, including repeated customer harm or operational abuse. We may preserve evidence and logs for audit,
            dispute, and regulatory cooperation.
          </p>
        </div>

        <div>
          <h2 style={{ margin: "0 0 6px" }}>9. Liability and Governing Law</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            The platform is provided with commercially reasonable safeguards but without uninterrupted-service guarantees in
            all circumstances. This Agreement is governed by applicable laws of the Federal Republic of Nigeria, subject to
            competent jurisdiction and lawful dispute handling procedures.
          </p>
        </div>

        <div style={{ borderTop: "1px solid var(--ui-border)", paddingTop: 10 }}>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            By selecting "I have read and agree to merchant terms and policy" in onboarding, you confirm legal acceptance
            of this Agreement and all related operational/compliance policies published by SexxyMarket.
          </p>
        </div>
      </section>
    </main>
  );
}
