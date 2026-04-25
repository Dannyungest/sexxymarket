"use client";

import { GlobalLoadingProvider } from "@sexxymarket/ui";
import { StorefrontProvider } from "../components/storefront-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <GlobalLoadingProvider>
      <StorefrontProvider>{children}</StorefrontProvider>
    </GlobalLoadingProvider>
  );
}
