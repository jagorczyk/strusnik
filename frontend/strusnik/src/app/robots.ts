import type { MetadataRoute } from "next";

const siteUrl = "https://strusnik.pl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/auth",
        "/games/",
        "/profile",
        "/settings",
        "/lobby/*/createRoom",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
