import type { Metadata, Viewport } from "next";
import "./globals.css";
import { siteUrl } from "@/lib/env-public";

export const metadata: Metadata = {
  /**
   * Already normalised by `src/lib/env-public.ts`, so an unset or mistyped
   * `NEXT_PUBLIC_SITE_URL` degrades to the canonical site instead of throwing
   * `TypeError: Invalid URL` while metadata is being resolved at build time.
   */
  metadataBase: new URL(siteUrl || "https://zybble.app"),
  /**
   * Per-page titles are authored in full (e.g. "Pricing — zybble"), exactly as
   * they were in the original landing page, so no `%s` template is applied here
   * — applying one would render "Pricing — zybble — zybble".
   */
  title: "zybble — Turn Google Maps into verified leads",
  description:
    "zybble finds businesses on Google Maps, verifies their emails & phone numbers, and runs AI-powered outreach campaigns. Export clean CSVs from $19/mo.",
  applicationName: "zybble",
  keywords: [
    "google maps scraper",
    "lead generation",
    "business leads",
    "email verification",
    "b2b leads",
    "local business data",
  ],
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    type: "website",
    siteName: "zybble",
    title: "zybble — Turn Google Maps into verified leads",
    description:
      "Find businesses on Google Maps, verify emails & phone numbers, and run AI-powered outreach. Export clean CSVs from $19/mo.",
  },
  twitter: {
    card: "summary_large_image",
    title: "zybble — Turn Google Maps into verified leads",
    description:
      "Find businesses on Google Maps, verify emails & phone numbers, and run AI-powered outreach. Export clean CSVs from $19/mo.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0B100E",
  width: "device-width",
  initialScale: 1,
};

/**
 * Fonts are loaded the same way the original landing page loaded them (a Google
 * Fonts stylesheet link), so the type rendering is byte-for-byte identical to
 * the design that shipped.
 *
 * `next/font/local` is the recommended upgrade for fully offline builds — see
 * docs/deployment.md — but using it here would change the loading strategy and
 * therefore the landing page's rendering.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
