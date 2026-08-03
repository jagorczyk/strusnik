import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Utwórz pokój",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CreateRoomLayout({ children }: { children: React.ReactNode }) {
  return children;
}
