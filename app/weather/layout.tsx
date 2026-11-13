import type { Metadata } from "next";

const title = "Hawaiʻi weather, surf and air right now — Kilo";
const description = "Today's forecast for your town, surf by shore, tides and air quality, from the National Weather Service.";

// Metadata merges shallowly: openGraph here replaces the root's whole object, so the image is repeated.
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/weather/" },
  openGraph: { title, description, url: "/weather/", siteName: "Kilo", type: "website", images: [{ url: "/og.jpg", width: 1200, height: 630 }] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
