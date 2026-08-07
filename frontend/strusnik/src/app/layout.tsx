import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SocketProvider } from "./context/SocketContext";
import { UserProvider } from "./context/UserContext";
import InvitationModal from "./components/lobby/invitationModal";
import { LangProvider } from "./lang";
import { MotionProvider } from "./motion";
import TopRightToggles from "./components/TopRightToggles";
import MobileAppHeader from "./components/MobileAppHeader";
import { NotificationProvider } from "./context/NotificationsContext";
import PageTransition from "./components/PageTransition";

const Perciles = localFont({
  src: "./fonts/Perciles.ttf",
  variable: "--font-perciles",
  display: "swap",
  fallback: ["Poppins", "Segoe UI", "system-ui", "sans-serif"],
});

const siteUrl = "https://strusnik.pl";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Strusnik – darmowe gry online",
    template: "%s | Strusnik",
  },
  description:
    "Graj online w szachy, Haxball, Stratego, Tysiąca, Statki i inne gry. Zagraj solo albo dołącz do pokoju ze znajomymi.",
  applicationName: "Strusnik",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "pl_PL",
    alternateLocale: ["en_US"],
    url: siteUrl,
    siteName: "Strusnik",
    title: "Strusnik – darmowe gry online",
    description:
      "Graj solo albo ze znajomymi w popularne gry online: szachy, Haxball, Stratego, Tysiąc i więcej.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Strusnik – darmowe gry online: szachy, Haxball, Stratego, Tysiąc i Statki",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Strusnik – darmowe gry online",
    description: "Darmowe gry online solo i multiplayer dla znajomych.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pl"
      className={Perciles.variable}
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>

      <body className="antialiased font-sans">
        <a className="skip-link" href="#main-content">Przejdz do tresci</a>
        <LangProvider>
          <MotionProvider>
            <NotificationProvider>
              <UserProvider>
                <SocketProvider>
                  <TopRightToggles />
                  <MobileAppHeader />
                  <InvitationModal />
                  <PageTransition>{children}</PageTransition>
                </SocketProvider>
              </UserProvider>
            </NotificationProvider>
          </MotionProvider>
        </LangProvider>
      </body>
    </html>
  );
}