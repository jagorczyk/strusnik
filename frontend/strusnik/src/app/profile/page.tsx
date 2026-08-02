"use client";

import React, { useState, useEffect } from "react";
import ReturnArrow from "../components/lobby/returnArrow";
import { Games } from "../constants/games";
import { useLang } from "@/app/lang";
import { t } from "@/app/i18n";
import ActiveGameBanner from "../components/lobby/ActiveGameBanner";
import { useSocket } from "../hooks/useSocket";
import { useUser } from "../hooks/useUser";
import AccountRequiredState from "../components/common/AccountRequiredState";
import AvatarPicker from "../components/profile/AvatarPicker";
import { getHaxballMap } from "../games/haxball/constants";

interface MultiplayerStats {
    games: number;
    wins: number;
    losses: number;
    win_ratio: number;
    total_wins: number;
    by_game: Record<string, { wins: number; losses?: number; draws?: number; goals?: number; assists?: number; points?: number }>;
}

interface SingleplayerStats {
    by_game: Record<string, {
        best_score: number;
        games_played: number;
    }>;
}

interface HaxballHistoryEntry {
    match_id: string;
    map_id: string;
    mode: string;
    duration_min: number;
    score: { red: number; blue: number };
    winner_team: "red" | "blue" | null;
    reason: string;
    ended_at: string;
    participants: Array<{ user_id: number | null; player_name: string; team: "red" | "blue"; goals: number; assists: number }>;
}

interface ProfileData {
    username: string;
    avatar_url?: string | null;
    created_at: string;
    last_login: string;
    multiplayer: MultiplayerStats;
    singleplayer: SingleplayerStats;
}

export default function ProfilePage() {
    const { lang } = useLang();
    const { activeGame: activeMultiplayerGame, setActiveGame: setActiveMultiplayerGame } = useSocket();
    const { userInfo, isLoading: isUserLoading, updateAvatarUrl } = useUser();

    const [profileData, setProfileData] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [haxballHistory, setHaxballHistory] = useState<HaxballHistoryEntry[]>([]);

    useEffect(() => {
        const fetchProfile = async () => {
            if (isUserLoading || userInfo?.isGuest) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const res = await fetch("/api/profile/me", {
                    credentials: "include",
                });

                if (res.ok) {
                    const data = await res.json();
                    setProfileData(data);
                    updateAvatarUrl(data.avatar_url ?? null);
                } else if (res.status === 401) {
                    setError(t(lang, "profile.error.not_logged_in"));
                } else {
                    setError(t(lang, "profile.error.fetch_failed"));
                }
            } catch (err) {
                console.error("Profile fetch error:", err);
                setError(t(lang, "profile.error.network"));
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [isUserLoading, lang, updateAvatarUrl, userInfo?.isGuest]);

    useEffect(() => {
        if (isUserLoading || userInfo?.isGuest) return;
        let cancelled = false;

        fetch("/api/profile/haxball/history", { credentials: "include" })
            .then(async (response) => {
                if (!response.ok) return [];
                return response.json() as Promise<HaxballHistoryEntry[]>;
            })
            .then((history) => {
                if (!cancelled && Array.isArray(history)) setHaxballHistory(history);
            })
            .catch(() => {
                if (!cancelled) setHaxballHistory([]);
            });

        return () => {
            cancelled = true;
        };
    }, [isUserLoading, userInfo?.isGuest]);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "-";
        const date = new Date(dateStr);
        return date.toLocaleDateString(lang === "pl" ? "pl-PL" : "en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    return (
        <main id="main-content" className="game-page-shell">
            <div className="absolute w-full h-screen flex flex-col overflow-visible">
                <ReturnArrow href="/" text={t(lang, "arrow")} />
            </div>

            {activeMultiplayerGame && (
                <div className="fixed top-12 sm:top-4 left-1/2 -translate-x-1/2 z-50 w-full px-2 sm:px-0 sm:w-auto">
                    <ActiveGameBanner
                        gameName={activeMultiplayerGame.gameName}
                        roomId={activeMultiplayerGame.roomId}
                        roomName={activeMultiplayerGame.roomName}
                        onDismiss={() => setActiveMultiplayerGame(null)}
                    />
                </div>
            )}

            <div className="game-page-frame z-10 flex w-full max-w-5xl flex-col gap-6">
                {userInfo?.isGuest && !isUserLoading ? <AccountRequiredState /> : null}

                {!userInfo?.isGuest && <h1 className="text-xl sm:text-2xl md:text-4xl font-bold text-center drop-shadow-lg tracking-wider text-gray-300 mt-8 sm:mt-12 md:mt-0">
                    {t(lang, "profile.title")}
                </h1>}

                {!userInfo?.isGuest && loading && (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-xl text-gray-400 animate-pulse">{t(lang, "loading")}</div>
                    </div>
                )}

                {!userInfo?.isGuest && error && (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-xl text-red-400">{error}</div>
                    </div>
                )}

                {!userInfo?.isGuest && profileData && !loading && !error && (
                    <>
                        <div className="game-panel">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex min-w-0 items-center gap-4">
                                    <div className="profile-page-avatar shrink-0">
                                        <AvatarPicker
                                            avatarUrl={profileData.avatar_url}
                                            displayName={profileData.username}
                                            inputId="profile-avatar-upload-page"
                                            large
                                            onUploaded={(avatarUrl) => {
                                                setProfileData((current) => current ? { ...current, avatar_url: avatarUrl } : current);
                                                updateAvatarUrl(avatarUrl);
                                            }}
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="break-words text-xl md:text-2xl font-bold text-white">{profileData.username}</h2>
                                        <p className="text-sm text-gray-400">
                                            {t(lang, "profile.member_since")}: {formatDate(profileData.created_at)}
                                        </p>
                                    </div>
                                </div>
                                <div className="min-w-0 break-words text-sm text-gray-400">
                                    {t(lang, "profile.last_login")}: {formatDate(profileData.last_login)}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            <div className="game-panel">
                                <h3 className="text-lg md:text-xl font-bold text-gray-300 mb-4 border-b border-app-border-strong pb-2">
                                    {t(lang, "profile.multiplayer_stats")}
                                </h3>

                                <div className="mb-4 p-3 bg-app-surface-soft/50 rounded-lg">
                                    <div className="text-sm text-gray-400">{t(lang, "profile.games")}</div>
                                    <div className="text-2xl md:text-3xl font-bold text-white">
                                        {profileData.multiplayer.games}
                                    </div>
                                </div>

                                <div className="mb-4 grid grid-cols-3 gap-2">
                                    <div className="min-w-0 p-3 bg-app-surface-soft/50 rounded-lg">
                                        <div className="break-words text-xs text-gray-400">{t(lang, "profile.wins")}</div>
                                        <div className="text-xl font-bold text-white">{profileData.multiplayer.wins}</div>
                                    </div>
                                    <div className="min-w-0 p-3 bg-app-surface-soft/50 rounded-lg">
                                        <div className="break-words text-xs text-gray-400">{t(lang, "profile.losses")}</div>
                                        <div className="text-xl font-bold text-white">{profileData.multiplayer.losses}</div>
                                    </div>
                                    <div className="min-w-0 p-3 bg-app-surface-soft/50 rounded-lg">
                                        <div className="break-words text-xs text-gray-400">{t(lang, "profile.win_ratio")}</div>
                                        <div className="profile-stat-value text-xl font-bold text-white">{profileData.multiplayer.win_ratio.toFixed(1)}%</div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {Games.multiplayer.map((game) => (
                                        <div
                                            key={game}
                                            className="flex min-w-0 justify-between items-center gap-2 p-2 bg-app-surface/70 rounded-lg"
                                        >
                                            <span className="text-gray-300 text-sm md:text-base">{game}</span>
                                            <span className="font-bold text-white text-right">
                                                {profileData.multiplayer.by_game[game.toLowerCase()]?.wins || 0} {t(lang, "profile.wins")}
                                                {game.toLowerCase() === "haxball" && (
                                                    <small className="block text-xs font-normal text-gray-400">
                                                        {profileData.multiplayer.by_game.haxball?.goals || 0} {t(lang, "haxball.goals")} · {profileData.multiplayer.by_game.haxball?.assists || 0} {t(lang, "haxball.assists")}
                                                    </small>
                                                )}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="game-panel">
                                <h3 className="text-lg md:text-xl font-bold text-gray-300 mb-4 border-b border-app-border-strong pb-2">
                                    {t(lang, "profile.singleplayer_stats")}
                                </h3>

                                <div className="space-y-3">
                                    {Games.singleplayer.map((game) => {
                                        const stats = profileData.singleplayer.by_game[game.toLowerCase()];
                                        return (
                                            <div
                                                key={game}
                                                className="min-w-0 p-3 bg-app-surface/70 rounded-lg"
                                            >
                                                <div className="flex min-w-0 justify-between items-center gap-2 mb-1">
                                                    <span className="min-w-0 break-words text-gray-300 font-medium">{game}</span>
                                                    <span className="shrink-0 text-xs text-gray-500">
                                                        {stats?.games_played || 0} {t(lang, "profile.games_played")}
                                                    </span>
                                                </div>
                                                <div className="flex min-w-0 justify-between items-center gap-2">
                                                    <span className="min-w-0 break-words text-sm text-gray-400">{t(lang, "profile.best_score")}</span>
                                                    <span className="text-xl font-bold text-white">
                                                        {stats?.best_score || 0}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <section className="game-panel haxball-history-panel" aria-labelledby="haxball-history-title">
                            <div className="haxball-history-heading">
                                <div>
                                    <p className="haxball-section-kicker">{t(lang, "games.haxball")}</p>
                                    <h2 id="haxball-history-title">{t(lang, "haxball.last_matches")}</h2>
                                </div>
                                <p>{t(lang, "haxball.history_hint")}</p>
                            </div>
                            {haxballHistory.length === 0 ? (
                                <div className="haxball-history-empty">
                                    <p>{t(lang, "haxball.history_empty")}</p>
                                </div>
                            ) : (
                                <div className="haxball-history-list" role="list">
                                    {haxballHistory.map((match) => {
                                        const participant = match.participants.find((item) => String(item.user_id) === String(userInfo?.userId));
                                        const won = Boolean(participant && match.winner_team === participant.team);
                                        const draw = match.winner_team === null;
                                        return (
                                            <article key={match.match_id} className="haxball-history-row" role="listitem">
                                                <div className="haxball-history-result">
                                                    <strong className={draw ? "is-draw" : won ? "is-win" : "is-loss"}>
                                                        {draw ? t(lang, "haxball.draw") : won ? t(lang, "haxball.win") : t(lang, "haxball.loss")}
                                                    </strong>
                                                    <span>{formatDate(match.ended_at)}</span>
                                                </div>
                                                <div className="haxball-history-map">
                                                    <strong>{t(lang, `haxball.maps.${getHaxballMap(match.map_id).nameKey}`)}</strong>
                                                    <span>{match.mode} · {match.duration_min} MIN</span>
                                                </div>
                                                <div className="haxball-history-score" aria-label={t(lang, "haxball.score")}>
                                                    <strong>{match.score.red} : {match.score.blue}</strong>
                                                </div>
                                                <div className="haxball-history-stats">
                                                    <span>{participant?.goals || 0} {t(lang, "haxball.goals")}</span>
                                                    <span>{participant?.assists || 0} {t(lang, "haxball.assists")}</span>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}
