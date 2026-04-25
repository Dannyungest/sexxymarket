"use client";

import { MerchantToastProvider } from "../../components/merchant-toast-context";

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return <MerchantToastProvider>{children}</MerchantToastProvider>;
}
