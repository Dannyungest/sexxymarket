"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark, ActionButton, useOptionalGlobalLoading } from "@sexxymarket/ui";
import {
  LayoutDashboard,
  ListChecks,
  PackageSearch,
  ShoppingCart,
  Store,
  UserCog,
  Users2,
  Menu,
  X,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { clearAdminSession } from "../lib/admin-auth";
import { useRouter } from "next/navigation";
import { AdminToastProvider } from "./admin-toast-context";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/merchants", label: "Merchants", icon: Store },
  { href: "/pending-listings", label: "Pending listings", icon: ListChecks },
  { href: "/products", label: "Products", icon: PackageSearch },
  { href: "/users", label: "Users", icon: Users2 },
  { href: "/admins", label: "Admins", icon: UserCog },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const globalLoading = useOptionalGlobalLoading();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [navPendingHref, setNavPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!globalLoading || !navPendingHref) return;
    globalLoading.end();
    setNavPendingHref(null);
  }, [pathname, globalLoading, navPendingHref]);

  const logout = () => {
    clearAdminSession();
    router.push("/login");
  };

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: (typeof nav)[number]["icon"] }) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className="admin-nav-link"
        data-active={active}
        onClick={() => {
          setDrawerOpen(false);
          if (href === pathname) return;
          setNavPendingHref(href);
          globalLoading?.begin();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0.5rem 0.75rem",
          borderRadius: 12,
          color: active ? "var(--ui-text)" : "var(--ui-muted)",
          background: active ? "color-mix(in srgb, var(--ui-accent) 18%, var(--ui-card-soft))" : "transparent",
          fontWeight: active ? 600 : 500,
          textDecoration: "none",
          border: `1px solid ${active ? "color-mix(in srgb, var(--ui-accent) 35%, var(--ui-border))" : "transparent"}`,
        }}
      >
        <Icon size={18} strokeWidth={1.8} />
        {label}
      </Link>
    );
  };

  return (
    <AdminToastProvider>
      <div className="admin-layout-root">
        <div
          className="admin-sidebar-overlay"
          data-open={drawerOpen}
          onClick={() => setDrawerOpen(false)}
          aria-hidden={!drawerOpen}
        />
        <aside className="admin-sidebar" data-open={drawerOpen} aria-label="Main navigation">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, padding: "0 0.2rem" }}>
            <BrandMark size={36} />
            <div>
              <strong style={{ fontSize: "0.95rem" }}>Sexxy Admin</strong>
              <p className="muted" style={{ margin: 0, fontSize: "0.75rem" }}>
                Operations
              </p>
            </div>
            <button
              type="button"
              className="chip admin-sidebar-close"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
            >
              <X size={16} />
            </button>
          </div>
          <nav style={{ display: "grid", gap: 4 }} role="navigation">
            {nav.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
            ))}
          </nav>
        </aside>

        <div className="admin-main">
          <header className="top-nav admin-topbar">
            <button
              type="button"
              className="chip admin-menu-btn"
              onClick={() => setDrawerOpen((o) => !o)}
              aria-expanded={drawerOpen}
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>
            <div className="admin-breadcrumb" style={{ flex: 1, minWidth: 0 }}>
              <span className="route-eyebrow" style={{ display: "block" }}>
                Console
              </span>
              <span style={{ fontFamily: "var(--font-heading), serif", fontSize: "1.1rem" }}>
                {nav.find((n) => n.href === pathname)?.label ?? "Dashboard"}
              </span>
              {navPendingHref ? (
                <span className="muted" role="status" aria-live="polite" style={{ display: "block", fontSize: "0.78rem" }}>
                  Opening {nav.find((n) => n.href === navPendingHref)?.label ?? "page"}...
                </span>
              ) : null}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ThemeToggle />
              <ActionButton ghost onClick={logout}>
                Logout
              </ActionButton>
            </div>
          </header>
          <main className="app-shell route-grid" style={{ paddingTop: 0 }}>
            {children}
          </main>
        </div>
      </div>
    </AdminToastProvider>
  );
}
