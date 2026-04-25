"use client";

import { StorefrontFooter } from "./storefront-footer";
import { StorefrontHeader } from "./storefront-header";

export function StorefrontShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StorefrontHeader />
      <main className="app-shell" role="main" aria-live="polite">
        {children}
      </main>
      <StorefrontFooter />
    </>
  );
}
