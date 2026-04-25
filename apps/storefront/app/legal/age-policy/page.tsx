import { SurfaceCard } from "@sexxymarket/ui";
import { StorefrontShell } from "../../../components/storefront-shell";

export default function AgePolicyPage() {
  return (
    <StorefrontShell>
      <section className="legal-wrap">
        <SurfaceCard className="legal-card">
          <p className="route-eyebrow" style={{ margin: 0 }}>Legal</p>
          <h1 className="section-title" style={{ marginTop: 4 }}>Age Restriction Policy (18+)</h1>
          <p className="section-lead">Last updated: April 22, 2026</p>
          <p className="legal-top">
            Sexxy Market is an adult-only marketplace. Access, account creation, and purchases are limited to users
            who are 18 years and above in their jurisdiction.
          </p>
        </SurfaceCard>
        <SurfaceCard className="legal-card">
          <div className="legal-section">
            <h2>Age verification expectation</h2>
            <ul className="legal-list">
              <li>By using this site, you confirm legal adult status in your location.</li>
              <li>We may request additional verification where risk indicators are detected.</li>
              <li>False declarations may lead to immediate account or order suspension.</li>
            </ul>
          </div>
          <div className="legal-section">
            <h2>Enforcement actions</h2>
            <ul className="legal-list">
              <li>Suspected underage activity may trigger service denial and transaction cancellation.</li>
              <li>Associated account data may be reviewed for compliance and safety investigation.</li>
              <li>Repeat or confirmed violations may result in permanent account restriction.</li>
            </ul>
          </div>
          <div className="legal-section">
            <h2>Parent and guardian notice</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              Parents and guardians are encouraged to supervise internet activity and apply parental controls to limit
              access to adult websites and related commerce platforms.
            </p>
          </div>
          <div className="legal-section">
            <h2>Related policies</h2>
            <p style={{ margin: 0, color: "var(--ui-muted)" }}>
              This policy works together with our Terms of Use and Privacy Policy for full platform governance and user
              protection standards.
            </p>
          </div>
        </SurfaceCard>
      </section>
    </StorefrontShell>
  );
}
