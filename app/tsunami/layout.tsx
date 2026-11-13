import type { Metadata } from "next";

const title = "Am I in a tsunami evacuation zone? — Kilo";
const description = "Check your spot against the official Hawaiʻi evacuation zones and see if a tsunami warning is in effect. Works offline.";

// Metadata merges shallowly: openGraph here replaces the root's whole object, so the image is repeated.
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/tsunami/" },
  openGraph: { title, description, url: "/tsunami/", siteName: "Kilo", type: "website", images: [{ url: "/og.jpg", width: 1200, height: 630 }] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
