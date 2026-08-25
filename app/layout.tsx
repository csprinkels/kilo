import type { Metadata, Viewport } from "next";
import { Inter, Merriweather } from "next/font/google";
import Script from "next/script";
import NativeBoot from "@/components/NativeBoot";
import StatTracker from "@/components/StatTracker";
import "./globals.css";
import { APP_NAME, TAGLINE } from "@/lib/brand";

// Two faces, self-hosted by next/font at build time so the offline shell carries them.
// Inter for everything you read; Merriweather (a sturdy serif, like Acme's) for headings only.
const body = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-body", display: "swap" });
const heading = Merriweather({ subsets: ["latin", "latin-ext"], weight: ["700"], variable: "--font-heading", display: "swap" });

export const metadata: Metadata = {
  title: `${APP_NAME} — ${TAGLINE}`,
  description: "Official Hawaiʻi alerts, storms, shelters, roads, weather, quakes, volcano and neighbor reports in one place. Works offline.",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${body.variable} ${heading.variable} h-full antialiased`}>
      <body className="relative min-h-full flex flex-col">
        {/* Kilo's own text size (Normal/Large/Largest) — applied before paint so nothing jumps. Standalone PWAs have no Safari aA button. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("text");if(t)document.documentElement.dataset.text=t}catch(e){}` }} />
        {children}
        <NativeBoot />
        <StatTracker />
        {/* The service worker is for the web. Inside the app the bundle is already offline, and WKWebView has no service workers anyway. */}
        <Script id="sw" strategy="afterInteractive">
          {`if ("serviceWorker" in navigator && !(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) navigator.serviceWorker.register("/sw.js");`}
        </Script>
      </body>
    </html>
  );
}
