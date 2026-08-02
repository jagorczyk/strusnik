"use client";

import CardList from "@/app/components/blackjack/cardList";
import Token from "@/app/components/blackjack/token";
import ReturnArrow from "@/app/components/lobby/returnArrow";
import { useBlackjack } from "@/app/hooks/useBlackjack";
import React, { useEffect, useRef } from "react";
import { useLang } from "@/app/lang";
import { t } from "@/app/i18n";
import { useNotification } from "@/app/context/NotificationsContext";

const CHIP_VALUES = [5, 20, 100, 500];

export default function BlackjackPage() {
  const {
    tokens,
    addToken,
    removeToken,
    balance,
    bet,
    startGame,
    gameStatus,
    playerDeck,
    dealerDeck,
    hit,
    stand,
    doubleDown,
    playAgain,
    playerDeckValue,
    dealerDeckValue,
    winner,
    cashout,
    isResolving,
  } = useBlackjack();

  const { lang } = useLang();
  const { notify } = useNotification();
  const previousStatusRef = useRef(gameStatus);
  const canStart = bet > 0;

  useEffect(() => {
    const previousStatus = previousStatusRef.current;

    if (gameStatus === "STARTED" && previousStatus === "NOT-STARTED") {
      notify(t(lang, "blackjack.notifications.started"), "info");
    }

    if (gameStatus === "FINISHED" && previousStatus === "STARTED") {
      if (winner === "PLAYER") {
        notify(
          t(lang, "blackjack.notifications.win").replace("{amount}", `${cashout}$`),
          "success",
        );
      } else if (winner === "DEALER") {
        notify(t(lang, "blackjack.notifications.lose"), "warning");
      } else {
        notify(t(lang, "blackjack.notifications.draw"), "info");
      }
    }

    if (gameStatus === "NOT-STARTED" && previousStatus === "FINISHED") {
      notify(t(lang, "blackjack.notifications.restarted"), "info");
    }

    previousStatusRef.current = gameStatus;
  }, [cashout, gameStatus, lang, notify, winner]);

  return (
    <div className="game-runtime-shell game-runtime-shell--singleplayer game-runtime-blackjack overflow-hidden">
      <ReturnArrow href="/singleplayer" text={t(lang, "arrow")} />

      {gameStatus !== "NOT-STARTED" && (
        <div className="blackjack-game-overlay absolute top-0 left-0 z-10 flex h-full w-full items-center justify-center pointer-events-none">
          <div className="pointer-events-auto flex h-full min-h-0 w-full max-w-7xl mx-auto">
            <CardList
              playerDeck={playerDeck}
              dealerDeck={dealerDeck}
              playerDeckValue={playerDeckValue}
              dealerDeckValue={dealerDeckValue}
              gameStatus={gameStatus}
              hit={hit}
              stand={stand}
              doubleDown={doubleDown}
              bet={bet}
              balance={balance}
              isResolving={isResolving}
              winner={winner}
              cashout={cashout}
              playAgain={playAgain}
            />
          </div>
        </div>
      )}

      {gameStatus === "NOT-STARTED" && (
        <main id="main-content" className="blackjack-bet-stage">
          <section className="blackjack-bet-intro" aria-labelledby="blackjack-title">
            <p className="blackjack-kicker">{t(lang, "blackjack.kicker")}</p>
            <h1 id="blackjack-title">{t(lang, "blackjack.title")}</h1>
            <p>{t(lang, "blackjack.subtitle")}</p>
          </section>

          <section className="blackjack-betting-layout" aria-label={t(lang, "blackjack.betting_area")}>
            <div className="blackjack-betting-surface">
              <div className="blackjack-money-row">
                <div>
                  <span className="blackjack-stat-label">{t(lang, "blackjack.balance")}</span>
                  <strong className="blackjack-money-value">{balance}$</strong>
                </div>
                <div className="blackjack-current-bet">
                  <span className="blackjack-stat-label">{t(lang, "blackjack.bet")}</span>
                  <strong className="blackjack-money-value">{bet}$</strong>
                </div>
              </div>

              <div className="blackjack-bet-zone" aria-live="polite">
                <div className="blackjack-zone-heading">
                  <div>
                    <span className="blackjack-stat-label">{t(lang, "blackjack.chips_in_play")}</span>
                    <p>{t(lang, tokens.length ? "blackjack.bet_ready" : "blackjack.empty_bet")}</p>
                  </div>
                  <span className="blackjack-bet-total">{bet}$</span>
                </div>

                <div className={`blackjack-bet-stack${tokens.length === 0 ? " blackjack-bet-stack--empty" : ""}`}>
                  {tokens.length > 0 ? (
                    tokens.map((token, index) => (
                      <button
                        key={`${token}-${index}`}
                        type="button"
                        className="blackjack-placed-chip"
                        onClick={() => removeToken(index)}
                        aria-label={`${t(lang, "blackjack.remove_chip")} ${token}$`}
                      >
                        <Token amount={token} withText />
                      </button>
                    ))
                  ) : (
                    <span>{t(lang, "blackjack.place_bet_hint")}</span>
                  )}
                </div>
              </div>
            </div>

            <aside className="blackjack-chip-picker" aria-labelledby="blackjack-chip-picker-title">
              <div>
                <span className="blackjack-stat-label">{t(lang, "blackjack.chip_kicker")}</span>
                <h2 id="blackjack-chip-picker-title">{t(lang, "blackjack.choose_chip")}</h2>
              </div>
              <div className="blackjack-chip-options" role="group" aria-label={t(lang, "blackjack.choose_chip")}>
                {CHIP_VALUES.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className="blackjack-chip-choice"
                    onClick={() => addToken(amount)}
                    disabled={balance < amount}
                    aria-label={`${t(lang, "blackjack.add_chip")} ${amount}$`}
                  >
                    <Token amount={amount} withText />
                    <span>{amount}$</span>
                  </button>
                ))}
              </div>
              <p className="blackjack-chip-help">{t(lang, "blackjack.chip_help")}</p>
            </aside>
          </section>

          <div className="blackjack-start-area">
            <button
              type="button"
              className="blackjack-start-button"
              onClick={startGame}
              disabled={!canStart}
            >
              <span>{t(lang, "blackjack.start")}</span>
              <small>{t(lang, canStart ? "blackjack.start_hint" : "blackjack.empty_bet")}</small>
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
