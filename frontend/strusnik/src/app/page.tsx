'use client';

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import Button from "./components/main/button";
import { useLang } from "./lang";
import { t } from "./i18n";
import { useSocket } from "./hooks/useSocket";
import ActiveGameBanner from "./components/lobby/ActiveGameBanner";
import { ArrowUpRight, Gamepad2, History, Shield, Trophy, UserRound, UsersRound } from "lucide-react";

export default function HomePage() {
  const { lang } = useLang();
  const { activeGame, setActiveGame } = useSocket();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await fetch('/api/admin/check', { credentials: 'include' });
        const data = await res.json();
        setIsAdmin(data.is_admin || false);
      } catch {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, []);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Strusnik",
    url: "https://strusnik.pl",
    description:
      "Darmowe gry online solo i multiplayer: szachy, Haxball, Stratego, Tysiąc, Statki i więcej.",
    applicationCategory: "GameApplication",
    operatingSystem: "Web browser",
    inLanguage: ["pl-PL", "en-US"],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "PLN",
    },
  };

  return (
    <main id="main-content" className="app-shell safe-area-inset">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      {activeGame && (
        <div className="fixed top-12 sm:top-4 left-1/2 -translate-x-1/2 z-50 w-full px-2 sm:px-0 sm:w-auto">
          <ActiveGameBanner
            gameName={activeGame.gameName}
            roomId={activeGame.roomId}
            roomName={activeGame.roomName}
            onDismiss={() => setActiveGame(null)}
          />
        </div>
      )}

      <div className="app-frame">
        <header className="app-topbar">
          <Link className="brand-lockup" href="/" aria-label="Strusnik, strona główna">
            <span className="brand-lockup__mark" aria-hidden="true">
              <Image src="/favicon.ico" alt="" width={30} height={30} priority />
            </span>
            <span className="brand-lockup__name">Strusnik</span>
            <span className="brand-lockup__tagline">online games</span>
          </Link>
        </header>

        <div className="home-layout">
          <section className="home-intro" aria-labelledby="home-title">
            <p className="home-eyebrow">{t(lang, "home.eyebrow")}</p>
            <h1 id="home-title" className="home-title">{t(lang, "home.title")}</h1>
            <p id="home-subtitle" className="home-subtitle">{t(lang, "home.subtitle")}</p>
            <p className="home-proof">{t(lang, "home.proof")}</p>
          </section>

          <div className="home-actions-column">
            <nav className="home-actions" aria-label={t(lang, "home.menu_label")}>
              <Button
                icon={<Gamepad2 size={20} />}
                index={0}
                text={t(lang, "home.single")}
                description={t(lang, "home.single_desc")}
                href="/singleplayer"
              />
              <Button
                icon={<UsersRound size={20} />}
                index={1}
                text={t(lang, "home.multi")}
                description={t(lang, "home.multi_desc")}
                href="/multiplayer"
              />
              <Button
                icon={<Trophy size={20} />}
                index={2}
                text={t(lang, "home.rankings")}
                description={t(lang, "home.rankings_desc")}
                href="/rankings"
              />
              <Button
                icon={<UserRound size={20} />}
                index={3}
                text={t(lang, "home.profile")}
                description={t(lang, "home.profile_desc")}
                href="/profile"
              />
              {isAdmin && (
                <Button
                  icon={<Shield size={20} />}
                  index={4}
                  text={t(lang, "home.admin")}
                  description={t(lang, "home.admin_desc")}
                  href="/admin"
                />
              )}
            </nav>
            <Link
              className="home-changelog-link"
              href="/changelog"
              style={{ "--action-delay": `${180 + (isAdmin ? 5 : 4) * 90}ms` } as CSSProperties}
            >
              <History size={17} aria-hidden="true" />
              <span>{t(lang, "home.changelog")}</span>
              <ArrowUpRight size={16} aria-hidden="true" />
              <span className="sr-only">{t(lang, "home.changelog_desc")}</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}