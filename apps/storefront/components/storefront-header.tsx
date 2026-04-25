"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionButton, BrandMark } from "@sexxymarket/ui";
import { Gem, ShieldCheck, ShoppingBag } from "lucide-react";
import { useStorefront } from "./storefront-provider";
import { ThemeToggle } from "./theme-toggle";

export function StorefrontHeader() {
  const router = useRouter();
  const { cartCount } = useStorefront();

  return (
    <header className="top-nav">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BrandMark size={40} />
        <div>
          <strong style={{ fontSize: "1.04rem", letterSpacing: "0.012em", lineHeight: 1.1 }}>Sexxy Market</strong>
          <div className="icon-inline" style={{ color: "var(--ui-muted)", fontSize: "0.8rem" }}>
            <Gem size={14} strokeWidth={1.85} /> Luxury wellness, discreet nationwide delivery
          </div>
        </div>
      </div>
      <nav style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
        <Link href="/" className="nav-link">Home</Link>
        <Link href="/products" className="nav-link">Products</Link>
        <Link href="/account" className="nav-link">Account</Link>
        <Link href="/cart" className="nav-link icon-inline">
          <ShoppingBag size={15} strokeWidth={1.85} />
          Cart <span className="cart-badge" suppressHydrationWarning>{cartCount}</span>
        </Link>
        <ThemeToggle />
        <div className="icon-inline" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ShieldCheck size={15} strokeWidth={1.85} />
          <ActionButton type="button" onClick={() => router.push("/checkout")}>
            Checkout
          </ActionButton>
        </div>
      </nav>
    </header>
  );
}
