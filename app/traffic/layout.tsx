import type { Metadata } from "next";

const title = "Hawaiʻi road closures right now — Kilo";
const description = "Every closed road on your island on one map, with the official way around when the county lists one.";

// Metadata merges shallowly: openGraph here replaces the root's whole object, so the image is repeated.
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/traffic/" },
  openGraph: { title, description, url: "/traffic/", siteName: "Kilo", type: "website", images: [{ url: "/og.jpg", width: 1200, height: 630 }] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
