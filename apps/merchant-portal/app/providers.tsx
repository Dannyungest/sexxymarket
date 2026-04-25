"use client";

import { GlobalLoadingProvider } from "@sexxymarket/ui";

export function MerchantAppProviders({ children }: { children: React.ReactNode }) {
  return <GlobalLoadingProvider>{children}</GlobalLoadingProvider>;
}
