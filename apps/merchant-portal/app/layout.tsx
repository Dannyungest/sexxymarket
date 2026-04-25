import type { Metadata } from "next";
import "./globals.css";
import { MerchantAppProviders } from "./providers";
import { ApiWarmup } from "../components/api-warmup";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.MERCHANT_PORTAL_URL ?? "https://merchant.sexxymarket.com"),
  title: {
    default: "SexxyMarket Merchant Portal",
    template: "%s | SexxyMarket Merchant",
  },
  description:
    "Merchant workspace for onboarding, catalog management, order visibility, and growth on SexxyMarket.",
  applicationName: "SexxyMarket Merchant",
  icons: {
    icon: "/sexxymarketlogo.png",
    shortcut: "/sexxymarketlogo.png",
    apple: "/sexxymarketlogo.png",
  },
  openGraph: {
    title: "SexxyMarket Merchant Portal",
    description: "Manage products and grow your business with SexxyMarket.",
    url: "/",
    siteName: "SexxyMarket Merchant Portal",
    type: "website",
    images: [{ url: "/sexxymarketlogo.png", width: 512, height: 512, alt: "SexxyMarket logo" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="app-body">
        <ApiWarmup />
        <MerchantAppProviders>{children}</MerchantAppProviders>
      </body>
    </html>
  );
}
