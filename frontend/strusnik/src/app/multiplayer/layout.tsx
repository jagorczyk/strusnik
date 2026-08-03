import type { Metadata } from "next";
import "./../globals.css";

export const metadata: Metadata = {
  title: "Gry multiplayer online",
  description:
    "Dołącz do pokoju i zagraj ze znajomymi online w szachy, Haxball, Stratego, Tysiąca, Statki lub Set.",
  alternates: {
    canonical: "/multiplayer",
  },
};

export default function MultiplayerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <div>
        {children}
      </div>
  );
}
