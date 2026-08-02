'use client';

import ReturnArrow from "../components/lobby/returnArrow";
import Card from "../components/menu/card";
import CardContainer from "../components/menu/cardContainer";
import ActiveGameBanner from "../components/lobby/ActiveGameBanner";
import { useSocket } from "../hooks/useSocket";
import { useLang } from "../lang";
import { t } from "../i18n";

export default function MultiplayerGamesPage() {
    const { lang } = useLang();
    const { activeGame, setActiveGame } = useSocket();

    return (
        <main id="main-content" className="game-select-shell">
            <ReturnArrow href="/" text={t(lang, "arrow")} />

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

            <div className="game-select-frame">
                <header className="page-heading">
                    <p className="page-kicker">{t(lang, "games.selection_kicker")}</p>
                    <h1>{t(lang, "home.multi")}</h1>
                    <p className="page-subtitle">{t(lang, "games.multi_subtitle")}</p>
                </header>

                <CardContainer>
                    <Card imgSrc='/gameTiles/tile_tysiac.png' gameName='Tysiac' />
                    <Card imgSrc='/gameTiles/tile_stratego.png' gameName='Stratego' />
                    <Card imgSrc='/gameTiles/tile_chess.png' gameName='Chess' />
                    <Card imgSrc='/gameTiles/tile_battleships.png' gameName='Battleships' />
                    <Card imgSrc='/gameTiles/tile_set.png' gameName='Set' />
                    <Card imgSrc='/gameTiles/tile_haxball.png' gameName='Haxball' />
                </CardContainer>
            </div>
        </main>
    );
}
