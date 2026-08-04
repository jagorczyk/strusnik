import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Historia zmian",
  description: "Najważniejsze nowe funkcje, ulepszenia i poprawki w Strusniku.",
  alternates: {
    canonical: "/changelog",
  },
  openGraph: {
    title: "Historia zmian | Strusnik",
    description: "Najważniejsze nowe funkcje, ulepszenia i poprawki w Strusniku.",
    url: "/changelog",
  },
};

export default function ChangelogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
