import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Darmowe gry solo online",
  description:
    "Zagraj solo online w Blackjacka, Snake'a albo Kółko i krzyżyk. Szybka rozgrywka bez instalowania aplikacji.",
  alternates: {
    canonical: "/singleplayer",
  },
};

export default function SingleplayerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
