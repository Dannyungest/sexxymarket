import Link from "next/link";
import { DELIVERY_ESTIMATE_SHORT } from "../lib/delivery-copy";

export function StorefrontFooter() {
  return (
    <footer className="storefront-footer">
      <p className="footer-delivery" style={{ margin: "0 0 10px" }}>
        {DELIVERY_ESTIMATE_SHORT}
      </p>
      <nav className="footer-legal" aria-label="Legal">
        <Link href="/legal/terms">Terms of use</Link>
        <span aria-hidden>·</span>
        <Link href="/legal/privacy">Privacy policy</Link>
        <span aria-hidden>·</span>
        <Link href="/legal/refund">Refund policy</Link>
        <span aria-hidden>·</span>
        <Link href="/legal/age-policy">18+ policy</Link>
      </nav>
    </footer>
  );
}
