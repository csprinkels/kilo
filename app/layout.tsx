import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { APP_NAME, TAGLINE } from "@/lib/brand";

// Self-hosted by next/font at build time, so the offline shell carries them too.
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", axes: ["opsz", "SOFT"], display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: `${APP_NAME} — ${TAGLINE}`,
  description: "Official Hawaiʻi alerts, storms, shelters, roads, weather, quakes, volcano and neighbour reports in one place. Works offline.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: APP_NAME },
  icons: { icon: [{ url: "/favicon.png", sizes: "64x64" }, { url: "/icon.svg", type: "image/svg+xml" }], apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#121311" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="relative min-h-full flex flex-col">
        {children}
        <Script id="sw" strategy="afterInteractive">
          {`if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");`}
        </Script>
      </body>
    </html>
  );
}
