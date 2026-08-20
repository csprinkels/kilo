import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",            // static files only: Cloudflare Pages now, Capacitor webDir later
  images: { unoptimized: true },
  trailingSlash: true,         // /sources -> /sources/index.html, works on any static host
};

export default nextConfig;
