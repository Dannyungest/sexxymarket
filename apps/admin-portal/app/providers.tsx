"use client";

import { GlobalLoadingProvider } from "@sexxymarket/ui";

export function AdminAppProviders({ children }: { children: React.ReactNode }) {
  return <GlobalLoadingProvider>{children}</GlobalLoadingProvider>;
}
