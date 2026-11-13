import type { Metadata } from "next";

const title = "Report a road or power problem in Hawaiʻi — Kilo";
const description = "Tell your neighbors about a blocked road, flooding or an outage. No account needed.";

// Metadata merges shallowly: openGraph here replaces the root's whole object, so the image is repeated.
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/report/" },
  openGraph: { title, description, url: "/report/", siteName: "Kilo", type: "website", images: [{ url: "/og.jpg", width: 1200, height: 630 }] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
