import type { Metadata } from "next";
import "./globals.css";
import { AdminAppProviders } from "./providers";
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
  metadataBase: new URL(process.env.ADMIN_PORTAL_URL ?? "https://admin.sexxymarket.com"),
  title: {
    default: "SexxyMarket Admin Portal",
    template: "%s | SexxyMarket Admin",
  },
  description:
    "Secure admin workspace for SexxyMarket operations: orders, merchants, products, users, and compliance controls.",
  applicationName: "SexxyMarket Admin",
  icons: {
    icon: "/sexxymarketlogo.PNG",
    shortcut: "/sexxymarketlogo.PNG",
    apple: "/sexxymarketlogo.PNG",
  },
  openGraph: {
    title: "SexxyMarket Admin Portal",
    description: "Operational command center for SexxyMarket platform administration.",
    url: "/",
    siteName: "SexxyMarket Admin",
    type: "website",
    images: [{ url: "/sexxymarketlogo.PNG", width: 512, height: 512, alt: "SexxyMarket logo" }],
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
        <AdminAppProviders>{children}</AdminAppProviders>
      </body>
    </html>
  );
}
