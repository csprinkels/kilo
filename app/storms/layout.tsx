import type { Metadata } from "next";

const title = "Is a hurricane coming to Hawaiʻi? — Kilo";
const description = "Hurricanes and tropical storms near Hawaiʻi: the official track, when it arrives and what to do on your island.";

// Metadata merges shallowly: openGraph here replaces the root's whole object, so the image is repeated.
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/storms/" },
  openGraph: { title, description, url: "/storms/", siteName: "Kilo", type: "website", images: [{ url: "/og.jpg", width: 1200, height: 630 }] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
