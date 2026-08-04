import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // The game grid cards render below the default 640px image breakpoint.
    // Keep a 384px device size so Next can select the existing 256px variant
    // for narrow cards instead of over-fetching a 384px image.
    deviceSizes: [384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    localPatterns: [
      { pathname: "/gameTiles/**" },
      { pathname: "/blackjack/**" },
      { pathname: "/favicon.ico" },
    ],
  },
};

export default nextConfig;
