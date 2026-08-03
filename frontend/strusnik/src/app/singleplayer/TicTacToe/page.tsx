"use client";

import React, { useEffect, useRef } from "react";
import Board from "@/app/components/tictactoe/Board";
import ReturnArrow from "@/app/components/lobby/returnArrow";
import { useTicTacToe } from "@/app/hooks/useTicTacToe";
import { useLang } from "@/app/lang";
import { t } from "@/app/i18n";
import { useNotification } from "@/app/context/NotificationsContext";

export default function TicTacToePage() {
  const { lang } = useLang();
  const { notify } = useNotification();
  const { board, currentPlayer, gameActive, winner, handleClick, resetGame } = useTicTacToe();
  const previousActiveRef = useRef(gameActive);

  useEffect(() => {
    if (previousActiveRef.current && !gameActive) {
      if (winner === "X") {
        notify(t(lang, "tictactoe.notifications.win"), "success");
      } else if (winner === "O") {
        notify(t(lang, "tictactoe.notifications.lose"), "warning");
      } else {
        notify(t(lang, "tictactoe.notifications.draw"), "info");
      }
    }

    previousActiveRef.current = gameActive;
  }, [gameActive, lang, notify, winner]);

  const handleReset = () => {
    resetGame();
    notify(t(lang, "tictactoe.notifications.restarted"), "info");
  };

  const plankClass =
    "game-runtime-asset-button w-full h-16 bg-no-repeat bg-center bg-cover flex items-center justify-center text-white font-extrabold tracking-wide";

  const statusText = winner
    ? `${t(lang, "tictactoe.winner")}: ${winner}`
    : gameActive
      ? `${t(lang, "tictactoe.turn")}: ${currentPlayer}`
      : t(lang, "tictactoe.draw");

  return (
    <div className="game-runtime-shell game-runtime-shell--singleplayer overflow-hidden">
      <div className="absolute w-full h-screen flex flex-col overflow-visible">
        <ReturnArrow href="/singleplayer" text={t(lang, "arrow")} />
      </div>

      <div className="game-runtime-game relative z-10 w-full h-full">
        <div className="flex flex-col items-center gap-4 w-[min(400px,92vw)]">
          <div className={plankClass} style={{ backgroundImage: "url('/main/button.webp')" }}>
            <span className="text-lg">{statusText}</span>
          </div>

          <div className="game-runtime-tictactoe-board">
            <Board board={board} onSquareClick={handleClick} />
          </div>

          <button
            onClick={handleReset}
            className={plankClass + " hover:brightness-110 transition"}
            style={{ backgroundImage: "url('/main/button.webp')" }}
          >
            {t(lang, "tictactoe.new_game")}
          </button>
        </div>
      </div>
    </div>
  );
}
