import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      { pathname: "/gameTiles/**" },
      { pathname: "/blackjack/**" },
      { pathname: "/favicon.ico" },
    ],
  },
};

export default nextConfig;
