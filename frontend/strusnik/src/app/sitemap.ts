import type { MetadataRoute } from "next";

const siteUrl = "https://strusnik.pl";
const lobbyGames = ["chess", "stratego", "tysiac", "battleships", "set", "haxball"];

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/multiplayer`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/singleplayer`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/rankings`,
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  return [
    ...pages,
    ...lobbyGames.map((game) => ({
      url: `${siteUrl}/lobby/${game}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
