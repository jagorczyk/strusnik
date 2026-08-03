import type { Metadata } from "next";

const gameLabels: Record<string, string> = {
  chess: "szachy",
  stratego: "Stratego",
  tysiac: "Tysiąc",
  battleships: "Statki",
  set: "Set",
  haxball: "Haxball",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.toLowerCase();
  const label = gameLabels[slug];

  if (!label) {
    return {
      title: "Lobby gry",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `${label} online – zagraj ze znajomymi`,
    description: `Dołącz do otwartego pokoju ${label} online albo utwórz własną rozgrywkę ze znajomymi.`,
    alternates: {
      canonical: `/lobby/${slug}`,
    },
  };
}

export default function LobbyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
