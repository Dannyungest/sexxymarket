"use client";

import { MerchantToastProvider } from "../../components/merchant-toast-context";

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return <MerchantToastProvider>{children}</MerchantToastProvider>;
}
