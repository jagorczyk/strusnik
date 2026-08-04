"use client";

import { Games } from "@/app/constants/games";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { ArrowUpRight } from "lucide-react";
import { useLang } from "@/app/lang";
import { t } from "@/app/i18n";
import { useSocket } from "@/app/hooks/useSocket";

interface CardProps {
  gameName: string;
  imgSrc: string;
  compact?: boolean;
  index?: number;
}

function gameKey(name: string) {
  return name.trim().toLowerCase();
}

export default function Card({ gameName, imgSrc, index = 0 }: CardProps) {
  const { lang } = useLang();
  const { onlinePlayers } = useSocket();
  const isMultiplayer = !Games["singleplayer"].includes(gameName);
  const playersInGame = onlinePlayers.filter(
    (player) => player.status === "in_game" && player.gameName?.toLowerCase() === gameName.toLowerCase()
  ).length;

  const getGameLink = () => {
    if (Games["singleplayer"].includes(gameName)) return `/singleplayer/${gameName}`;
    return `/lobby/${gameName}`;
  };

  const title = t(lang, `games.${gameKey(gameName)}`);
  const description = isMultiplayer
    ? (lang === "pl"
      ? `${playersInGame} ${playersInGame === 1 ? "osoba" : playersInGame >= 2 && playersInGame <= 4 ? "osoby" : "osob"} w grze`
      : `${playersInGame} ${playersInGame === 1 ? "player" : "players"} in game`)
    : (lang === "pl" ? "Rozgrywka solo" : "Solo game");

  return (
    <Link
      href={getGameLink()}
      className="game-card"
      style={{ "--card-delay": `${120 + index * 80}ms` } as React.CSSProperties}
    >
      <span className="game-card__image">
        <Image
          alt=""
          src={imgSrc}
          fill
          sizes="(max-width: 390px) 100vw, (max-width: 720px) 50vw, 25vw"
        />
        <span className="game-card__glow" aria-hidden="true" />
      </span>
      <div className="game-card__content">
        <div>
          <h2>{title}</h2>
          <p className={isMultiplayer && playersInGame > 0 ? "game-card__presence is-active" : "game-card__presence"}>
            {isMultiplayer && <span aria-hidden="true" />}
            {description}
          </p>
        </div>
        <ArrowUpRight className="game-card__arrow" size={20} aria-hidden="true" />
      </div>
    </Link>
  );
}
