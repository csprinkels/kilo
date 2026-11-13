import type { Metadata } from "next";

const title = "Earthquakes in Hawaiʻi today — Kilo";
const description = "Recent Hawaiʻi earthquakes from USGS: where, how strong and when.";

// Metadata merges shallowly: openGraph here replaces the root's whole object, so the image is repeated.
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/quakes/" },
  openGraph: { title, description, url: "/quakes/", siteName: "Kilo", type: "website", images: [{ url: "/og.jpg", width: 1200, height: 630 }] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
