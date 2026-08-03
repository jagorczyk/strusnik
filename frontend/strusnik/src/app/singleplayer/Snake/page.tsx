"use client";

import ReturnArrow from "@/app/components/lobby/returnArrow";
import { useSnake } from "@/app/hooks/useSnake";
import React, { useEffect, useRef } from "react";
import { useLang } from "@/app/lang";
import { t } from "@/app/i18n";
import { useNotification } from "@/app/context/NotificationsContext";

type GridRect = { x: number; y: number; w: number; h: number };

const BOARD_IMG = { w: 644, h: 630 };

// The playable tiles are an inset of the artwork. Keeping this as percentages
// makes the collision surface follow the image at every viewport size.
const GRID_RECT: GridRect = {
  x: 87 / BOARD_IMG.w,
  y: 56 / BOARD_IMG.h,
  w: 468 / BOARD_IMG.w,
  h: 468 / BOARD_IMG.h,
};

type Dir = "UP" | "DOWN" | "LEFT" | "RIGHT";

const vecToDir = (dx: number, dy: number): Dir => {
  if (dx === 1 && dy === 0) return "RIGHT";
  if (dx === -1 && dy === 0) return "LEFT";
  if (dx === 0 && dy === 1) return "DOWN";
  return "UP";
};

const isPair = (a: Dir, b: Dir, p: Dir, q: Dir) => (a === p && b === q) || (a === q && b === p);

const degFromFacingRight = (dir: Dir) => {
  if (dir === "RIGHT") return 0;
  if (dir === "DOWN") return 90;
  if (dir === "LEFT") return 180;
  return 270;
};

const degFromTailTipLeft = (tipDir: Dir) => {
  if (tipDir === "LEFT") return 0;
  if (tipDir === "DOWN") return 270;
  if (tipDir === "RIGHT") return 180;
  return 90;
};

const SNAKE_SPRITES = {
  head: "/snake/head.png",
  straight: "/snake/straight.png",
  turn: "/snake/turn.png",
  tail: "/snake/tail.png",
} as const;

export default function SnakePage() {
  const { BOARD_SIZE, snake, food, gameStatus, score, isSubmittingScore, startGame, enqueueDirection } = useSnake();
  const { lang } = useLang();
  const { notify } = useNotification();
  const previousStatusRef = useRef(gameStatus);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;

    if (gameStatus === "STARTED" && previousStatus !== "STARTED") {
      notify(
        t(lang, previousStatus === "FINISHED" ? "snake.notifications.restarted" : "snake.notifications.started"),
        "info",
      );
    }

    if (gameStatus === "FINISHED" && previousStatus === "STARTED") {
      notify(
        t(lang, "snake.notifications.finished").replace("{score}", String(score)),
        "warning",
      );
    }

    previousStatusRef.current = gameStatus;
  }, [gameStatus, lang, notify, score]);

  const isSnakeCell = (x: number, y: number) => snake.some((seg) => seg.x === x && seg.y === y);
  const isFoodCell = (x: number, y: number) => food.x === x && food.y === y;

  const plankClass =
    "game-runtime-asset-button w-full h-16 bg-no-repeat bg-center bg-cover flex items-center justify-center text-white font-extrabold tracking-wide";

  const getSnakeSpriteAtIndex = (i: number): { src: string; rot: number } => {
    if (i === 0) {
      if (snake.length < 2) return { src: SNAKE_SPRITES.head, rot: 0 };
      const head = snake[0];
      const neck = snake[1];
      const moveDir = vecToDir(head.x - neck.x, head.y - neck.y);
      return { src: SNAKE_SPRITES.head, rot: degFromFacingRight(moveDir) };
    }

    if (i === snake.length - 1) {
      const tail = snake[i];
      const prev = snake[i - 1];
      const tipDir = vecToDir(tail.x - prev.x, tail.y - prev.y);
      return { src: SNAKE_SPRITES.tail, rot: degFromTailTipLeft(tipDir) };
    }

    const prev = snake[i - 1];
    const curr = snake[i];
    const next = snake[i + 1];

    const d1 = vecToDir(prev.x - curr.x, prev.y - curr.y);
    const d2 = vecToDir(next.x - curr.x, next.y - curr.y);

    if (isPair(d1, d2, "LEFT", "RIGHT")) return { src: SNAKE_SPRITES.straight, rot: 0 };
    if (isPair(d1, d2, "UP", "DOWN")) return { src: SNAKE_SPRITES.straight, rot: 90 };

    let rot = 0;
    if (isPair(d1, d2, "RIGHT", "DOWN")) rot = 0;
    else if (isPair(d1, d2, "DOWN", "LEFT")) rot = 90;
    else if (isPair(d1, d2, "LEFT", "UP")) rot = 180;
    else if (isPair(d1, d2, "UP", "RIGHT")) rot = 270;

    return { src: SNAKE_SPRITES.turn, rot };
  };

  const btnClass = "game-runtime-button w-16 h-16 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-xl flex items-center justify-center text-2xl select-none touch-manipulation";

  return (
    <div className="game-runtime-shell game-runtime-shell--singleplayer overflow-hidden">
      <div className="absolute w-full h-screen flex flex-col overflow-visible">
        <ReturnArrow href="/singleplayer" text={t(lang, "arrow")} />
      </div>

      <div className="game-runtime-game relative z-10 w-full h-full">
        <div className="flex flex-col items-center gap-4 w-[min(680px,92vw)]">
          <div className={plankClass} style={{ backgroundImage: "url('/main/button.webp')" }}>
            <span className="text-lg">
              {t(lang, "snake.score")}: {score}
              {isSubmittingScore && t(lang, "snake.submitting")}
            </span>
          </div>

          <div
            className="game-runtime-board-surface relative w-[min(680px,92vw,calc(100dvh-260px))] bg-no-repeat bg-center bg-contain"
            style={{
              aspectRatio: `${BOARD_IMG.w} / ${BOARD_IMG.h}`,
              backgroundImage: "url('/snake/board.webp')",
              backgroundSize: "contain",
              padding: 0,
            }}
          >
            <div
              className="absolute grid"
              style={{
                left: `${GRID_RECT.x * 100}%`,
                top: `${GRID_RECT.y * 100}%`,
                width: `${GRID_RECT.w * 100}%`,
                height: `${GRID_RECT.h * 100}%`,
                gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: BOARD_SIZE }).map((_, y) =>
                Array.from({ length: BOARD_SIZE }).map((_, x) => {
                  const snakeHere = isSnakeCell(x, y);
                  const foodHere = isFoodCell(x, y);

                  const snakeIndex = snakeHere ? snake.findIndex((seg) => seg.x === x && seg.y === y) : -1;
                  const snakeSprite = snakeIndex >= 0 ? getSnakeSpriteAtIndex(snakeIndex) : null;

                  return (
                    <div
                      key={`${x}-${y}`}
                      style={{
                        minWidth: 0,
                        minHeight: 0,
                        position: snakeSprite || foodHere ? "relative" : undefined,
                      }}
                      className="bg-black/0"
                    >
                      {foodHere && (
                        <img
                          src="/favicon.ico"
                          alt=""
                          draggable={false}
                          className="absolute inset-0 w-full h-full select-none pointer-events-none"
                        />
                      )}

                      {snakeSprite && (
                        <img
                          src={snakeSprite.src}
                          alt=""
                          draggable={false}
                          className="absolute inset-0 w-full h-full select-none pointer-events-none"
                          style={{
                            transform: `rotate(${snakeSprite.rot}deg)`,
                            transformOrigin: "50% 50%",
                          }}
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {gameStatus === "NOT-STARTED" && (
            <button
              onClick={startGame}
              className={plankClass + " hover:brightness-110 transition"}
              style={{ backgroundImage: "url('/main/button.webp')" }}
            >
              {t(lang, "snake.play")}
            </button>
          )}

          {gameStatus === "STARTED" && (
            <button
              className={plankClass + " hover:brightness-110 transition"}
              style={{ backgroundImage: "url('/main/button.webp')" }}
            >
              {t(lang, "snake.in_progress")}
            </button>
          )}

          {gameStatus === "FINISHED" && (
            <button
              onClick={startGame}
              className={plankClass + " hover:brightness-110 transition"}
              style={{ backgroundImage: "url('/main/button.webp')" }}
            >
              {t(lang, "snake.play_again")}
            </button>
          )}
        </div>

        <div className="absolute bottom-6 right-6 z-50 flex flex-col gap-2 items-center md:hidden opacity-80">
            <button 
              className={btnClass} 
              onPointerDown={(e) => { e.preventDefault(); enqueueDirection("UP"); }}
              aria-label="Up"
            >
              ▲
            </button>
            <div className="flex gap-2">
                <button 
                  className={btnClass} 
                  onPointerDown={(e) => { e.preventDefault(); enqueueDirection("LEFT"); }}
                  aria-label="Left"
                >
                  ◀
                </button>
                <button 
                  className={btnClass} 
                  onPointerDown={(e) => { e.preventDefault(); enqueueDirection("DOWN"); }}
                  aria-label="Down"
                >
                  ▼
                </button>
                <button 
                  className={btnClass} 
                  onPointerDown={(e) => { e.preventDefault(); enqueueDirection("RIGHT"); }}
                  aria-label="Right"
                >
                  ▶
                </button>
            </div>
        </div>

      </div>
    </div>
  );
}