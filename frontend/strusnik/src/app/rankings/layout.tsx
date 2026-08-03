import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rankingi graczy i wyniki gier online",
  description:
    "Sprawdź rankingi graczy Strusnika i porównaj wyniki w szachach, Haxballu, Stratego, Tysiącu, Statkach i Secie.",
  alternates: {
    canonical: "/rankings",
  },
};

export default function RankingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
