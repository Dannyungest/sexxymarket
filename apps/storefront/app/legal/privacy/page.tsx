import { SurfaceCard } from "@sexxymarket/ui";
import { StorefrontShell } from "../../../components/storefront-shell";

export default function PrivacyPage() {
  return (
    <StorefrontShell>
      <section className="legal-wrap">
        <SurfaceCard className="legal-card">
          <p className="route-eyebrow" style={{ margin: 0 }}>Legal</p>
          <h1 className="section-title" style={{ marginTop: 4 }}>Privacy policy</h1>
          <p className="section-lead">Last updated: April 24, 2026</p>
          <p className="legal-top">
            Sexxy Market (“we”, “us”, or “our”) respects your privacy. This policy explains what personal data we
            collect, why we use it, how we protect it, and the choices you have. It applies to visitors, registered
            customers, and merchants who use our website and related services, except where a separate agreement
            (such as a merchant contract) says otherwise.
          </p>
        </SurfaceCard>
        <SurfaceCard className="legal-card">
          <div className="legal-section">
            <h2>1. Who is responsible for your data</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              The data controller for personal data processed through the Sexxy Market platform is the operating entity
              named in your order documentation or merchant agreement. For day-to-day questions about this policy,
              contact us through the official support channels published on the site.
            </p>
          </div>
          <div className="legal-section">
            <h2>2. Data we collect</h2>
            <p style={{ margin: "0 0 8px", color: "var(--ui-muted)" }}>We may process:</p>
            <ul className="legal-list">
              <li>
                <strong>Account and identity data</strong> — name, email address, phone number, and password (stored
                using one-way hashing), and account preferences.
              </li>
              <li>
                <strong>Transaction and order data</strong> — products ordered, delivery and billing addresses
                (where provided), order references, and payment status (we do not store full card numbers; see
                section 5).
              </li>
              <li>
                <strong>Communications</strong> — messages you send to support, feedback, and (where you opt in)
                marketing-related preferences.
              </li>
              <li>
                <strong>Technical and security data</strong> — IP address, device and browser type, approximate
                location, cookies or similar technologies, and logs for security, fraud prevention, and service
                improvement.
              </li>
              <li>
                <strong>Merchant and compliance data</strong> — for sellers on the platform, business and
                verification information required to operate safely and to meet legal obligations.
              </li>
            </ul>
          </div>
          <div className="legal-section">
            <h2>3. How and why we use your data (legal bases)</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              We use personal data to: provide the marketplace and your account; process and deliver orders; take
              payment; communicate about your order or account; send service and security messages; improve the
              platform; detect, prevent, and investigate fraud, abuse, or illegal activity; comply with law and
              respond to lawful requests; and, where you have consented, send marketing (you can withdraw consent at
              any time for optional communications). Where the law requires a “legal basis”, we rely on
              performance of a contract, legitimate interests (balanced against your rights), legal obligation, and
              consent, as appropriate to the activity.
            </p>
          </div>
          <div className="legal-section">
            <h2>4. Cookies and similar technologies</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              We use cookies and similar tools to run essential site functions (such as security and session
              management), remember preferences, and understand how the service is used. You can control many cookies
              through your browser settings; disabling essential cookies may affect how the site works.
            </p>
          </div>
          <div className="legal-section">
            <h2>5. Payments</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              Card and wallet payments are processed by regulated payment partners. We do not store your full card
              number on our systems. We receive limited information from the payment provider (such as status and
              transaction reference) to confirm your order. Our partners’ privacy notices apply to their collection
              and use of payment data.
            </p>
          </div>
          <div className="legal-section">
            <h2>6. Sharing and international transfers</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              We share data with: sellers (merchants) to the extent needed to fulfill your order; payment, delivery,
              and technology providers who assist in operating the service; professional advisers where required; and
              authorities when the law compels or permits disclosure. Some providers may process data in other
              countries. Where we transfer data internationally, we use appropriate safeguards (such as contractual
              clauses) where required by law.
            </p>
          </div>
          <div className="legal-section">
            <h2>7. Retention</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              We keep personal data only as long as needed for the purposes above, including meeting legal, tax, and
              accounting requirements, handling disputes, and maintaining security. Retention periods vary by data
              type; order and financial records are typically kept for a number of years as required by law. When data
              is no longer required, we delete or anonymize it, subject to limited archival needs.
            </p>
          </div>
          <div className="legal-section">
            <h2>8. Security</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              We implement technical and organizational measures appropriate to the risk, including encryption in
              transit, access controls, and staff training. No method of transmission over the internet is completely
              secure; we work to protect your data but cannot guarantee absolute security.
            </p>
          </div>
          <div className="legal-section">
            <h2>9. Your rights</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              Depending on where you live, you may have the right to access, correct, delete, or restrict certain
              processing of your personal data, to data portability, to object to some processing, and to withdraw
              consent where processing is based on consent. You may also have the right to complain to a supervisory
              authority. To exercise your rights, contact us through official support. We will verify your identity
              before acting on requests.
            </p>
          </div>
          <div className="legal-section">
            <h2>10. Children</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              Our service is not directed at anyone under 18, and we do not knowingly collect personal data from
              children. If you believe we have collected data from a minor, contact us and we will take steps to
              delete it.
            </p>
          </div>
          <div className="legal-section">
            <h2>11. Changes to this policy</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              We may update this policy from time to time. The “Last updated” date will change when we do. For
              material changes, we may provide additional notice (for example, by email or a notice on the site).
              Please review this page periodically.
            </p>
          </div>
          <div className="legal-section">
            <h2>12. Contact</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              For privacy requests or questions about this policy, use the support or contact options published on
              Sexxy Market. We will respond within a reasonable time in line with applicable law.
            </p>
          </div>
        </SurfaceCard>
      </section>
    </StorefrontShell>
  );
}
