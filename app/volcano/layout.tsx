import type { Metadata } from "next";

const title = "Is Kīlauea erupting right now? — Kilo";
const description = "Today's volcano update from the Hawaiian Volcano Observatory, with vog and air quality for Hawaiʻi Island.";

// Metadata merges shallowly: openGraph here replaces the root's whole object, so the image is repeated.
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/volcano/" },
  openGraph: { title, description, url: "/volcano/", siteName: "Kilo", type: "website", images: [{ url: "/og.jpg", width: 1200, height: 630 }] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
