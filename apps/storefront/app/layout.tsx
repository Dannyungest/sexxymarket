import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "./app-providers";
import { ApiWarmup } from "../components/api-warmup";
import { Cormorant_Garamond, Inter } from "next/font/google";

const headingFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "https://sexxymarket.com"),
  title: {
    default: "SexxyMarket | Premium Adult Wellness Store in Nigeria",
    template: "%s | SexxyMarket",
  },
  description:
    "Shop premium adult wellness products in Nigeria with discreet delivery, trusted quality, and secure checkout.",
  applicationName: "SexxyMarket",
  keywords: [
    "adult wellness Nigeria",
    "discreet delivery",
    "intimate care",
    "secure checkout",
    "SexxyMarket",
  ],
  icons: {
    icon: "/sexxymarketlogo.PNG",
    shortcut: "/sexxymarketlogo.PNG",
    apple: "/sexxymarketlogo.PNG",
  },
  openGraph: {
    title: "SexxyMarket | Premium Adult Wellness Store in Nigeria",
    description:
      "Discover curated adult wellness essentials with discreet delivery and secure payment on SexxyMarket.",
    url: "/",
    siteName: "SexxyMarket",
    type: "website",
    images: [{ url: "/sexxymarketlogo.PNG", width: 512, height: 512, alt: "SexxyMarket logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SexxyMarket | Premium Adult Wellness Store in Nigeria",
    description:
      "Curated adult wellness products, discreet delivery, and secure checkout in Nigeria.",
    images: ["/sexxymarketlogo.PNG"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`app-body ${headingFont.variable} ${bodyFont.variable}`}>
        <ApiWarmup />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
