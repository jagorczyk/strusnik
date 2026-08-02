"use client";

import Image from "next/image";
import { Check, Clock3, MapPinned, Play, UsersRound } from "lucide-react";
import type { Socket } from "socket.io-client";
import HaxballMapPreview from "@/app/components/haxball/HaxballMapPreview";
import OnlinePlayersList from "@/app/components/lobby/onlinePlayersList";
import PlayerTile from "@/app/components/multiplayer/PlayerTile";
import MultiplayerShell from "@/app/components/multiplayer/MultiplayerShell";
import type { PlayerTileModel } from "@/app/components/multiplayer/types";
import RoomObserverSettings from "@/app/components/lobby/RoomObserverSettings";
import { HAXBALL_DURATIONS, HAXBALL_MAPS, type HaxballState, type HaxballTeam } from "@/app/games/haxball/constants";
import { useLang } from "@/app/lang";
import { t } from "@/app/i18n";

interface HaxballWaitingRoomProps {
  socket: Socket | null;
  roomId: string;
  state: HaxballState;
  userId: string;
  hostId: string | null;
  isHost: boolean;
  isObserver: boolean;
  onChooseTeam: (team: HaxballTeam) => void;
  onReady: (ready: boolean) => void;
  onStart: () => void;
  onMapChange: (mapId: string) => void;
  onDurationChange: (duration: number) => void;
}

function teamLabel(lang: "pl" | "en", team: HaxballTeam) {
  return t(lang, team === "red" ? "haxball.team_red" : "haxball.team_blue");
}

function avatarUrlForSeat(userId: string) {
  return String(userId).startsWith("guest_") ? null : `/api/profile/avatar/${encodeURIComponent(String(userId))}`;
}

export default function HaxballWaitingRoom({
  socket,
  roomId,
  state,
  userId,
  hostId,
  isHost,
  isObserver,
  onChooseTeam,
  onReady,
  onStart,
  onMapChange,
  onDurationChange,
}: HaxballWaitingRoomProps) {
  const { lang } = useLang();
  const redPlayers = state.seats.filter((seat) => seat?.team === "red") as NonNullable<typeof state.seats[number]>[];
  const bluePlayers = state.seats.filter((seat) => seat?.team === "blue") as NonNullable<typeof state.seats[number]>[];
  const mySeat = state.seats.find((seat) => seat && String(seat.userId) === String(userId));
  const allReady = state.seats.length === state.max_players && state.seats.every((seat) => Boolean(seat?.ready && seat.connected));
  const teamsFull = redPlayers.length === state.max_players / 2 && bluePlayers.length === state.max_players / 2;
  const selectedMap = HAXBALL_MAPS.find((map) => map.id === state.map_id) ?? HAXBALL_MAPS[0];

  const renderTeam = (team: HaxballTeam, players: typeof redPlayers) => {
    const filled = players.length;
    const isFull = filled >= state.max_players / 2;
    return (
      <section className={`haxball-team-panel haxball-team-panel--${team}`} aria-labelledby={`${team}-team-title`}>
        <header className="haxball-team-panel__header">
          <div>
            <p className="haxball-team-panel__kicker">{team === "red" ? "01" : "02"}</p>
            <h2 id={`${team}-team-title`}>{teamLabel(lang, team)}</h2>
          </div>
          <span className="haxball-team-panel__count"><UsersRound size={15} aria-hidden="true" /> {filled}/{state.max_players / 2}</span>
        </header>
        <div className="haxball-team-panel__players" role="list" aria-label={teamLabel(lang, team)}>
          {players.map((player) => {
            const model: PlayerTileModel = {
              id: String(player.userId),
              displayName: player.name,
              avatarUrl: avatarUrlForSeat(player.userId),
              isSelf: String(player.userId) === String(userId),
              selfLabel: t(lang, 'multiplayer.you'),
              role: 'player',
              team: { id: team, label: teamLabel(lang, team) },
              connection: player.connected ? 'connected' : 'disconnected',
              activity: player.ready ? 'ready' : 'not_ready',
              activityLabel: player.ready ? t(lang, 'haxball.ready') : t(lang, 'haxball.not_ready'),
              metric: { label: t(lang, 'haxball.goals'), value: String(player.goals) },
            };
            return (
              <div key={player.userId} className="haxball-seat" role="listitem">
                <PlayerTile model={model} variant="lobby" compact className="haxball-seat__tile" />
              </div>
            );
          })}
          {Array.from({ length: state.max_players / 2 - filled }).map((_, index) => (
            <button
              key={`${team}-empty-${index}`}
              type="button"
              className="haxball-seat haxball-seat--empty"
              disabled={isObserver || isFull || Boolean(mySeat?.ready)}
              onClick={() => onChooseTeam(team)}
              aria-label={`${teamLabel(lang, team)} ${index + 1}, ${t(lang, "rooms.join")}`}
            >
              <span className="haxball-seat__plus" aria-hidden="true">+</span>
              <span className="haxball-seat__copy">
                <strong>{t(lang, "lobby.empty_seat")}</strong>
                <span>{isFull ? t(lang, "haxball.team_full") : t(lang, "rooms.join")}</span>
              </span>
            </button>
          ))}
        </div>
        {!isObserver && !isFull && mySeat?.team !== team && (
          <button type="button" className="haxball-team-panel__join" onClick={() => onChooseTeam(team)} disabled={Boolean(mySeat?.ready)}>
            <span>{t(lang, "haxball.choose_team")}</span>
            <span aria-hidden="true">↗</span>
          </button>
        )}
      </section>
    );
  };

  return (
    <>
      <OnlinePlayersList inviteMode currentRoomId={roomId} placement="top" />
      <MultiplayerShell
        stage="lobby"
        title={t(lang, 'games.haxball')}
        status={isObserver ? t(lang, 'multiplayer.status.observer') : teamsFull ? t(lang, 'haxball.waiting_host') : t(lang, 'haxball.waiting_teams')}
        className="multiplayer-active-shell multiplayer-active-shell--haxball-lobby"
      >
      <div className="haxball-waiting-layout">
        <section className="haxball-waiting-card" aria-labelledby="haxball-waiting-title">
          <header className="haxball-waiting-header">
            <div className="haxball-waiting-splash" aria-hidden="true">
              <Image
                src="/gameTiles/tile_haxball.png"
                alt=""
                fill
                priority
                sizes="(max-width: 760px) 100vw, 760px"
              />
            </div>
            <div>
              <p className="haxball-eyebrow">{t(lang, "haxball.kicker")}</p>
              <h1 id="haxball-waiting-title">{t(lang, "haxball.waiting")}</h1>
              <p>{teamsFull ? t(lang, "haxball.waiting_host") : t(lang, "haxball.waiting_teams")}</p>
            </div>
            <div className="haxball-room-facts">
              <span><UsersRound size={16} aria-hidden="true" />{state.mode}</span>
              <span><Clock3 size={16} aria-hidden="true" />{state.duration_min} MIN</span>
              <span><MapPinned size={16} aria-hidden="true" />{t(lang, `haxball.maps.${selectedMap.nameKey}`)}</span>
            </div>
          </header>

          <div className="haxball-team-grid">
            {renderTeam("red", redPlayers)}
            {renderTeam("blue", bluePlayers)}
          </div>

          <section className="haxball-settings-card" aria-labelledby="haxball-settings-title">
            <div className="haxball-settings-heading">
              <div>
                <p className="haxball-section-kicker">{t(lang, "haxball.settings")}</p>
                <h2 id="haxball-settings-title">{t(lang, `haxball.maps.${selectedMap.nameKey}`)}</h2>
              </div>
              {!isHost && <span className="haxball-readonly-note">{t(lang, "haxball.settings_readonly")}</span>}
            </div>
            <div className="haxball-current-map">
              <HaxballMapPreview map={selectedMap} />
              <p>{t(lang, `haxball.maps.${selectedMap.descriptionKey}`)}</p>
            </div>
            {isHost ? (
              <>
                <div className="haxball-map-scroll" role="radiogroup" aria-label={t(lang, "haxball.map")}>
                  {HAXBALL_MAPS.map((map) => (
                    <button
                      key={map.id}
                      type="button"
                      role="radio"
                      aria-checked={state.map_id === map.id}
                      className={`haxball-map-mini${state.map_id === map.id ? " is-selected" : ""}`}
                      onClick={() => onMapChange(map.id)}
                    >
                      <HaxballMapPreview map={map} compact />
                      <span>{t(lang, `haxball.maps.${map.nameKey}`)}</span>
                    </button>
                  ))}
                </div>
                <div className="haxball-duration-row" role="radiogroup" aria-label={t(lang, "haxball.duration")}>
                  {HAXBALL_DURATIONS.map((duration) => (
                    <button
                      key={duration}
                      type="button"
                      role="radio"
                      aria-checked={state.duration_min === duration}
                      className={`haxball-duration-choice${state.duration_min === duration ? " is-selected" : ""}`}
                      onClick={() => onDurationChange(duration)}
                    >
                      {duration} MIN
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </section>

          <footer className="haxball-waiting-actions">
            {!isObserver && mySeat ? (
              <button
                type="button"
                className={`game-secondary-button haxball-ready-button${mySeat.ready ? " is-ready" : ""}`}
                onClick={() => onReady(!mySeat.ready)}
              >
                {mySeat.ready ? <Check size={17} aria-hidden="true" /> : null}
                <span>{mySeat.ready ? t(lang, "haxball.cancel_ready") : t(lang, "haxball.set_ready")}</span>
              </button>
            ) : (
              <span className="haxball-spectator-note">
                {isObserver ? t(lang, "haxball.spectating") : t(lang, "haxball.choose_team")}
              </span>
            )}
            {isHost ? (
              <button type="button" className="game-primary-button" disabled={!allReady} onClick={onStart}>
                <Play size={17} aria-hidden="true" />
                <span>{t(lang, "haxball.start")}</span>
              </button>
            ) : (
              <span className="haxball-waiting-host">{allReady ? t(lang, "haxball.waiting_host") : t(lang, "haxball.waiting_players")}</span>
            )}
          </footer>
          <RoomObserverSettings socket={socket} roomId={roomId} hostId={hostId} />
        </section>
      </div>
      </MultiplayerShell>
    </>
  );
}
