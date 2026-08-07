'use client';

import { ArrowUpRight, Plus, UsersRound } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ActiveGameBanner from "@/app/components/lobby/ActiveGameBanner";
import ListOfRooms from "@/app/components/lobby/listOfRooms";
import OnlinePlayersList from "@/app/components/lobby/onlinePlayersList";
import ReturnArrow from "@/app/components/lobby/returnArrow";
import TournamentQueueButton from "@/app/components/lobby/TournamentQueueButton";
import { t } from "@/app/i18n";
import { useLang } from "@/app/lang";
import { useSocket } from "@/app/hooks/useSocket";

export default function LobbyPage() {
  const { lang } = useLang();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "chess";
  const { activeGame, setActiveGame } = useSocket();
  const gameKey = String(slug).toLowerCase();
  const translatedGameTitle = t(lang, `games.${gameKey}`);
  const gameTitle = translatedGameTitle.startsWith("games.") ? String(slug) : translatedGameTitle;

  return (
    <main id="main-content" className="lobby-shell safe-area-inset">
      <ReturnArrow href="/multiplayer" text={t(lang, "arrow")} />

      {activeGame && (
        <div className="lobby-active-game">
          <ActiveGameBanner
            gameName={activeGame.gameName}
            roomId={activeGame.roomId}
            roomName={activeGame.roomName}
            onDismiss={() => setActiveGame(null)}
          />
        </div>
      )}

      <div className="lobby-frame">
        <header className="lobby-header">
          <div className="lobby-heading">
            <p className="page-kicker">STRUSNIK / MULTIPLAYER</p>
            <h1 className="lobby-title">
              <span>{gameTitle}</span> {t(lang, "lobby.title_suffix")}
            </h1>
            <p className="lobby-subtitle">{t(lang, "lobby.page_subtitle")}</p>
          </div>

          <div className="lobby-header-actions">
            <TournamentQueueButton game={gameKey} />
            <Link className="lobby-create-action" href={`/lobby/${slug}/createRoom`}>
              <Plus size={19} strokeWidth={2} aria-hidden="true" />
              <span>{t(lang, "rooms.create")}</span>
              <ArrowUpRight size={18} strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>
        </header>

        <div className="lobby-layout">
          <section className="lobby-rooms-column" aria-label={t(lang, "lobby.rooms_title")}>
            <ListOfRooms gameName={slug} />
          </section>

          <aside className="lobby-sidebar" aria-label={t(lang, "lobby.players_title")}>
            <OnlinePlayersList placement="lobby" />

            <div className="lobby-sidebar-note">
              <span className="lobby-sidebar-note__icon" aria-hidden="true">
                <UsersRound size={18} strokeWidth={2} />
              </span>
              <div>
                <p className="lobby-sidebar-note__title">{t(lang, "lobby.online_hint_title")}</p>
                <p>{t(lang, "lobby.online_hint")}</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export const dynamicParams = true;
