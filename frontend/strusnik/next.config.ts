import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    cpus: 2,
  },
  images: {
    // Keep a 384px device size for the largest game grid cards while the
    // mobile sizes rule still selects the smaller 256px variant.
    deviceSizes: [384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    localPatterns: [
      { pathname: "/gameTiles/**" },
      { pathname: "/blackjack/**" },
      { pathname: "/favicon.ico" },
    ],
  },
};

export default nextConfig;
