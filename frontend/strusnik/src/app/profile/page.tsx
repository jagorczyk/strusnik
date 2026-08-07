"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Ban, CalendarDays, Gamepad2, History, RefreshCw, Swords, Trophy, UserRound, type LucideIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import ReturnArrow from "../components/lobby/returnArrow";
import { Games } from "../constants/games";
import { useLang } from "@/app/lang";
import { t } from "@/app/i18n";
import ActiveGameBanner from "../components/lobby/ActiveGameBanner";
import { useSocket } from "../hooks/useSocket";
import { useUser } from "../hooks/useUser";
import AccountRequiredState from "../components/common/AccountRequiredState";
import AvatarPicker from "../components/profile/AvatarPicker";
import ProfileAvatar from "../components/profile/ProfileAvatar";
import { getHaxballMap } from "../games/haxball/constants";

type GameStat = {
    wins: number;
    losses: number;
    draws: number;
    points: number;
    goals?: number;
    assists?: number;
};

type EloRating = {
    game: string;
    rating: number;
    games_played: number;
    wins: number;
    losses: number;
    draws: number;
    peak_rating: number;
    provisional: boolean;
    position?: number | null;
    total_players?: number;
};

type HistoryDetails = {
    map_id?: string;
    duration_min?: number;
    score?: { red: number; blue: number };
    goals?: number;
    assists?: number;
};

type HistoryEntry = {
    id: number | string;
    match_id: string;
    game: string;
    mode: "ranked" | "casual";
    result: "win" | "loss" | "draw";
    opponents: string[];
    played_at: string;
    elo_before?: number | null;
    elo_after?: number | null;
    elo_delta?: number | null;
    details?: HistoryDetails;
};

interface MultiplayerStats {
    games: number;
    wins: number;
    losses: number;
    draws: number;
    win_ratio: number;
    points: number;
    goals: number;
    assists: number;
    by_game: Record<string, GameStat>;
}

interface SingleplayerStats {
    by_game: Record<string, {
        best_score: number;
        games_played: number;
    }>;
}

interface ProfileData {
    username: string;
    avatar_url?: string | null;
    created_at?: string | null;
    last_login?: string | null;
    multiplayer: MultiplayerStats;
    elo?: EloRating[];
    history?: HistoryEntry[];
    singleplayer: SingleplayerStats;
}

type ProfileTab = "info" | "stats" | "history" | "blocked";

type MockBlockedPlayer = {
    id: string;
    username: string;
    blocked_at: string;
};

const PROFILE_TAB_VALUES: ProfileTab[] = ["info", "stats", "history", "blocked"];

const PROFILE_TABS: Array<{ id: ProfileTab; labelKey: string; Icon: LucideIcon }> = [
    { id: "info", labelKey: "profile.tab_information", Icon: UserRound },
    { id: "stats", labelKey: "profile.tab_stats", Icon: Gamepad2 },
    { id: "history", labelKey: "profile.tab_history", Icon: History },
    { id: "blocked", labelKey: "profile.tab_blocked", Icon: Ban },
];

const INITIAL_BLOCKED_PLAYERS: MockBlockedPlayer[] = [
    { id: "blocked-1", username: "Kuba_91", blocked_at: "2025-02-14T18:40:00.000Z" },
    { id: "blocked-2", username: "MartaFox", blocked_at: "2025-01-28T21:15:00.000Z" },
    { id: "blocked-3", username: "ZimnyWilk", blocked_at: "2024-12-09T16:05:00.000Z" },
];

const COMPETITIVE_GAMES = ["chess", "battleships", "stratego"];

const GAME_LABEL_KEYS: Record<string, string> = {
    chess: "chess",
    stratego: "stratego",
    tysiac: "tysiac",
    battleships: "battleships",
    set: "set",
    haxball: "haxball",
    blackjack: "blackjack",
    snake: "snake",
    tictactoe: "tictactoe",
};

function createDefaultElo(game: string): EloRating {
    return {
        game,
        rating: 500,
        games_played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        peak_rating: 500,
        provisional: false,
        position: null,
        total_players: 0,
    };
}

function getGameLabel(lang: "pl" | "en", game: string) {
    const key = GAME_LABEL_KEYS[game.toLowerCase()] ?? game.toLowerCase();
    const translated = t(lang, `games.${key}`);
    return translated === `games.${key}` ? game : translated;
}

function getResultLabel(lang: "pl" | "en", result: HistoryEntry["result"]) {
    return t(lang, `profile.result_${result}`);
}

function getResultClass(result: HistoryEntry["result"]) {
    return `profile-history-result profile-history-result--${result}`;
}

function isProfileTab(value: string | null): value is ProfileTab {
    return Boolean(value && PROFILE_TAB_VALUES.includes(value as ProfileTab));
}

function normalizeProfileTab(value: string | null): ProfileTab {
    return isProfileTab(value) ? value : "info";
}

interface ProfileTabsProps {
    lang: "pl" | "en";
    activeTab: ProfileTab;
    onChange: (tab: ProfileTab) => void;
}

function ProfileTabs({ lang, activeTab, onChange }: ProfileTabsProps) {
    const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

    const moveFocus = (index: number) => {
        const nextTab = PROFILE_TABS[index];
        if (!nextTab) return;
        onChange(nextTab.id);
        window.requestAnimationFrame(() => tabRefs.current[index]?.focus());
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        let nextIndex: number | null = null;
        if (event.key === "ArrowRight") nextIndex = (index + 1) % PROFILE_TABS.length;
        if (event.key === "ArrowLeft") nextIndex = (index - 1 + PROFILE_TABS.length) % PROFILE_TABS.length;
        if (event.key === "Home") nextIndex = 0;
        if (event.key === "End") nextIndex = PROFILE_TABS.length - 1;
        if (nextIndex === null) return;

        event.preventDefault();
        moveFocus(nextIndex);
    };

    return (
        <nav className="profile-tabs" aria-label={t(lang, "profile.tabs_label")}>
            <div className="profile-tabs__scroller">
                <div className="profile-tabs__list" role="tablist" aria-orientation="horizontal">
                    {PROFILE_TABS.map(({ id, labelKey, Icon }, index) => (
                        <button
                            key={id}
                            ref={(element) => { tabRefs.current[index] = element; }}
                            id={`profile-tab-${id}`}
                            type="button"
                            className={`profile-tab${activeTab === id ? " is-active" : ""}`}
                            role="tab"
                            aria-selected={activeTab === id}
                            aria-controls="profile-tabpanel"
                            tabIndex={activeTab === id ? 0 : -1}
                            onClick={() => onChange(id)}
                            onKeyDown={(event) => handleKeyDown(event, index)}
                        >
                            <Icon size={16} strokeWidth={2} aria-hidden="true" />
                            <span>{t(lang, labelKey)}</span>
                        </button>
                    ))}
                </div>
            </div>
        </nav>
    );
}

function ProfilePageContent() {
    const { lang } = useLang();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { activeGame: activeMultiplayerGame, setActiveGame: setActiveMultiplayerGame } = useSocket();
    const { userInfo, isLoading: isUserLoading, updateAvatarUrl } = useUser();

    const rawTab = searchParams.get("tab");
    const activeTab = normalizeProfileTab(rawTab);
    const [profileData, setProfileData] = useState<ProfileData | null>(null);
    const [blockedPlayers, setBlockedPlayers] = useState<MockBlockedPlayer[]>(INITIAL_BLOCKED_PLAYERS);
    const [unblockedPlayer, setUnblockedPlayer] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [historyGame, setHistoryGame] = useState("all");
    const [historyResult, setHistoryResult] = useState("all");

    useEffect(() => {
        if (rawTab !== null && !isProfileTab(rawTab)) {
            router.replace("/profile", { scroll: false });
        }
    }, [rawTab, router]);

    const handleTabChange = (tab: ProfileTab) => {
        const params = new URLSearchParams(searchParams.toString());
        if (tab === "info") params.delete("tab");
        else params.set("tab", tab);
        const query = params.toString();
        router.push(query ? `/profile?${query}` : "/profile", { scroll: false });
    };

    const handleUnblock = (player: MockBlockedPlayer) => {
        setBlockedPlayers((current) => current.filter((item) => item.id !== player.id));
        setUnblockedPlayer(player.username);
    };

    useEffect(() => {
        const fetchProfile = async () => {
            if (isUserLoading || userInfo?.isGuest) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const response = await fetch("/api/profile/me", {
                    credentials: "include",
                    cache: "no-store",
                });

                if (response.ok) {
                    const data = await response.json() as ProfileData;
                    setProfileData(data);
                    updateAvatarUrl(data.avatar_url ?? null);
                } else if (response.status === 401) {
                    setError(t(lang, "profile.error.not_logged_in"));
                } else {
                    setError(t(lang, "profile.error.fetch_failed"));
                }
            } catch (fetchError) {
                console.error("Profile fetch error:", fetchError);
                setError(t(lang, "profile.error.network"));
            } finally {
                setLoading(false);
            }
        };

        void fetchProfile();
    }, [isUserLoading, lang, updateAvatarUrl, userInfo?.isGuest]);

    const filteredHistory = useMemo(() => {
        const history = profileData?.history ?? [];
        return history.filter((entry) => (
            (historyGame === "all" || entry.game === historyGame)
            && (historyResult === "all" || entry.result === historyResult)
        ));
    }, [historyGame, historyResult, profileData?.history]);

    const formatDate = (dateString?: string | null) => {
        if (!dateString) return "—";
        return new Date(dateString).toLocaleDateString(lang === "pl" ? "pl-PL" : "en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    const formatDateTime = (dateString?: string | null) => {
        if (!dateString) return "—";
        const date = new Date(dateString);
        return `${date.toLocaleDateString(lang === "pl" ? "pl-PL" : "en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        })} · ${date.toLocaleTimeString(lang === "pl" ? "pl-PL" : "en-US", {
            hour: "2-digit",
            minute: "2-digit",
        })}`;
    };

    const formatEloDelta = (delta?: number | null) => {
        if (delta === null || delta === undefined) return "—";
        if (delta === 0) return "±0";
        return `${delta > 0 ? "+" : "−"}${Math.abs(delta)} ELO`;
    };

    const renderProfile = () => {
        if (!profileData) return null;

        const multiplayer = profileData.multiplayer;
        const allHistory = profileData.history ?? [];
        const eloByGame = new Map(
            (Array.isArray(profileData.elo) ? profileData.elo : []).map((rating) => [rating.game, rating]),
        );
        const eloRatings = COMPETITIVE_GAMES.map((game) => eloByGame.get(game) ?? createDefaultElo(game));
        const rankedGames = eloRatings.reduce((total, rating) => total + rating.games_played, 0);
        const peakElo = Math.max(...eloRatings.map((rating) => rating.peak_rating), 0);

        return (
            <>
                <header className="game-panel profile-hero">
                    <p className="profile-kicker"><UserRound size={15} aria-hidden="true" />{t(lang, "profile.title")}</p>
                    <div className="profile-hero-row">
                        <div className="profile-identity">
                            <div className="profile-page-avatar">
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
                            <div className="profile-identity__copy">
                                <h1>{profileData.username}</h1>
                            </div>
                        </div>
                        <dl className="profile-meta">
                        <div>
                            <dt><CalendarDays size={14} aria-hidden="true" />{t(lang, "profile.member_since")}</dt>
                            <dd>{formatDate(profileData.created_at)}</dd>
                        </div>
                        <div>
                            <dt>{t(lang, "profile.last_login")}</dt>
                            <dd>{formatDate(profileData.last_login)}</dd>
                        </div>
                        </dl>
                    </div>
                </header>

                <ProfileTabs lang={lang} activeTab={activeTab} onChange={handleTabChange} />

                <div
                    id="profile-tabpanel"
                    className="profile-tabpanel"
                    role="tabpanel"
                    aria-labelledby={`profile-tab-${activeTab}`}
                    tabIndex={0}
                >
                    {activeTab === "info" && (
                        <section className="game-panel profile-section profile-information" aria-labelledby="profile-information-title">
                            <div className="profile-section-heading">
                                <div>
                                    <p className="profile-section-kicker"><UserRound size={15} aria-hidden="true" />{t(lang, "profile.information_kicker")}</p>
                                    <h2 id="profile-information-title">{t(lang, "profile.information")}</h2>
                                </div>
                                <p>{t(lang, "profile.information_hint")}</p>
                            </div>
                            <dl className="profile-information-grid">
                                <div>
                                    <dt>{t(lang, "profile.username")}</dt>
                                    <dd>{profileData.username}</dd>
                                </div>
                                <div>
                                    <dt>{t(lang, "profile.member_since")}</dt>
                                    <dd>{formatDate(profileData.created_at)}</dd>
                                </div>
                                <div>
                                    <dt>{t(lang, "profile.last_login")}</dt>
                                    <dd>{formatDate(profileData.last_login)}</dd>
                                </div>
                            </dl>
                            <p className="profile-information-note">{t(lang, "profile.avatar_hint")}</p>
                        </section>
                    )}

                    {activeTab === "stats" && (
                        <>
                <section className="game-panel profile-section" aria-labelledby="profile-overview-title">
                    <div className="profile-section-heading">
                        <div>
                            <p className="profile-section-kicker"><ActivityIcon />{t(lang, "profile.overview_kicker")}</p>
                            <h2 id="profile-overview-title">{t(lang, "profile.overview")}</h2>
                        </div>
                        <p>{t(lang, "profile.overview_hint")}</p>
                    </div>
                    <div className="profile-summary-grid">
                        <SummaryCard label={t(lang, "profile.games")} value={multiplayer.games} />
                        <SummaryCard label={t(lang, "profile.wins")} value={multiplayer.wins} accent="success" />
                        <SummaryCard label={t(lang, "profile.win_ratio")} value={`${multiplayer.win_ratio.toFixed(1)}%`} />
                        <SummaryCard label={t(lang, "profile.points")} value={multiplayer.points} />
                    </div>
                </section>

                <section className="game-panel profile-section" aria-labelledby="profile-elo-title">
                    <div className="profile-section-heading">
                        <div>
                            <p className="profile-section-kicker"><Trophy size={15} aria-hidden="true" />{t(lang, "profile.competitive_kicker")}</p>
                            <h2 id="profile-elo-title">{t(lang, "profile.competitive")}</h2>
                        </div>
                        <p>{t(lang, "profile.competitive_hint")}</p>
                    </div>
                    <div className="profile-elo-grid">
                        {eloRatings.map((rating) => (
                            <article className="profile-elo-card" key={rating.game}>
                                <div className="profile-elo-card__top">
                                    <div>
                                        <h3 className="profile-elo-card__game">{getGameLabel(lang, rating.game)}</h3>
                                    </div>
                                    <span className="profile-elo-card__icon" aria-hidden="true"><Swords size={18} /></span>
                                </div>
                                <div className="profile-elo-rating-row">
                                    <div className="profile-elo-value">
                                        <span className="profile-elo-value__label">{t(lang, "profile.elo")}</span>
                                        <strong className="profile-elo-rating">{rating.rating}</strong>
                                    </div>
                                    <div className="profile-elo-rank">
                                        <span>{t(lang, "profile.rank_position")}</span>
                                        <strong>{rating.position ? `#${rating.position}` : "—"}</strong>
                                        {rating.total_players ? <small>/ {rating.total_players}</small> : null}
                                    </div>
                                </div>
                                <dl className="profile-elo-stats">
                                    <div><dt>{t(lang, "profile.peak")}</dt><dd>{rating.peak_rating}</dd></div>
                                    <div><dt>{t(lang, "profile.rated_games")}</dt><dd>{rating.games_played}</dd></div>
                                    <div className="profile-elo-record"><dt>{t(lang, "profile.record")}</dt><dd>{rating.wins} W · {rating.losses} L · {rating.draws} D</dd></div>
                                </dl>
                            </article>
                        ))}
                    </div>
                    <div className="profile-elo-summary">
                        <span>{t(lang, "profile.rated_games")}</span>
                        <strong>{rankedGames}</strong>
                        <span>{t(lang, "profile.peak")}</span>
                        <strong>{peakElo}</strong>
                    </div>
                </section>

                <div className="profile-columns">
                    <section className="game-panel profile-section" aria-labelledby="profile-multiplayer-title">
                        <div className="profile-section-heading profile-section-heading--compact">
                            <div>
                                <p className="profile-section-kicker"><Gamepad2 size={15} aria-hidden="true" />{t(lang, "profile.multiplayer_kicker")}</p>
                                <h2 id="profile-multiplayer-title">{t(lang, "profile.multiplayer_stats")}</h2>
                            </div>
                        </div>
                        <div className="profile-game-list">
                            {Games.multiplayer.map((game) => {
                                const gameKey = game.toLowerCase();
                                const stats = multiplayer.by_game[gameKey] ?? { wins: 0, losses: 0, draws: 0, points: 0 };
                                const played = stats.wins + stats.losses + stats.draws;
                                return (
                                    <article className="profile-game-row" key={game}>
                                        <div>
                                            <strong>{getGameLabel(lang, gameKey)}</strong>
                                            <span>{played} {t(lang, "profile.games_played").toLowerCase()}</span>
                                        </div>
                                        <dl>
                                            <div><dt>W</dt><dd>{stats.wins}</dd></div>
                                            <div><dt>L</dt><dd>{stats.losses}</dd></div>
                                            <div><dt>D</dt><dd>{stats.draws}</dd></div>
                                            <div><dt>{t(lang, "profile.points")}</dt><dd>{stats.points}</dd></div>
                                        </dl>
                                    </article>
                                );
                            })}
                        </div>
                        <div className="profile-additional-stats">
                            <p className="profile-additional-stats__label">{t(lang, "profile.additional_stats")}</p>
                            <dl className="profile-detail-metrics">
                                <div><dt>{t(lang, "profile.draws")}</dt><dd>{multiplayer.draws}</dd></div>
                                <div><dt>{t(lang, "haxball.goals")}</dt><dd>{multiplayer.goals}</dd></div>
                                <div><dt>{t(lang, "haxball.assists")}</dt><dd>{multiplayer.assists}</dd></div>
                            </dl>
                        </div>
                    </section>

                    <section className="game-panel profile-section" aria-labelledby="profile-singleplayer-title">
                        <div className="profile-section-heading profile-section-heading--compact">
                            <div>
                                <p className="profile-section-kicker"><Gamepad2 size={15} aria-hidden="true" />{t(lang, "profile.singleplayer_kicker")}</p>
                                <h2 id="profile-singleplayer-title">{t(lang, "profile.singleplayer_stats")}</h2>
                            </div>
                        </div>
                        <div className="profile-single-list">
                            {Games.singleplayer.map((game) => {
                                const stats = profileData.singleplayer.by_game[game.toLowerCase()] ?? { best_score: 0, games_played: 0 };
                                return (
                                    <article className="profile-single-row" key={game}>
                                        <div>
                                            <strong>{getGameLabel(lang, game)}</strong>
                                            <span>{stats.games_played} {t(lang, "profile.games_played").toLowerCase()}</span>
                                        </div>
                                        <div>
                                            <span>{t(lang, "profile.best_score")}</span>
                                            <strong>{stats.best_score}</strong>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                </div>
                        </>
                    )}

                    {activeTab === "history" && (
                        <section className="game-panel profile-section profile-history" aria-labelledby="profile-history-title">
                    <div className="profile-section-heading profile-history-heading">
                        <div>
                            <p className="profile-section-kicker"><History size={15} aria-hidden="true" />{t(lang, "profile.history_kicker")}</p>
                            <h2 id="profile-history-title">{t(lang, "profile.history")}</h2>
                        </div>
                        <p>{t(lang, "profile.history_hint")}</p>
                    </div>
                    <div className="profile-history-toolbar" aria-label={t(lang, "profile.history_filters")}>
                        <label>
                            <span>{t(lang, "profile.all_games")}</span>
                            <select value={historyGame} onChange={(event) => setHistoryGame(event.target.value)}>
                                <option value="all">{t(lang, "profile.all_games")}</option>
                                {Games.multiplayer.map((game) => {
                                    const key = game.toLowerCase();
                                    return <option value={key} key={key}>{getGameLabel(lang, key)}</option>;
                                })}
                            </select>
                        </label>
                        <label>
                            <span>{t(lang, "profile.all_results")}</span>
                            <select value={historyResult} onChange={(event) => setHistoryResult(event.target.value)}>
                                <option value="all">{t(lang, "profile.all_results")}</option>
                                <option value="win">{t(lang, "profile.result_win")}</option>
                                <option value="loss">{t(lang, "profile.result_loss")}</option>
                                <option value="draw">{t(lang, "profile.result_draw")}</option>
                            </select>
                        </label>
                        <span className="profile-history-count">{filteredHistory.length} / {allHistory.length}</span>
                    </div>
                    {filteredHistory.length === 0 ? (
                        <div className="profile-history-empty">
                            <History size={22} aria-hidden="true" />
                            <p>{allHistory.length === 0 ? t(lang, "profile.no_history") : t(lang, "profile.no_filtered_history")}</p>
                        </div>
                    ) : (
                        <div className="profile-history-list" role="list">
                            {filteredHistory.map((entry) => {
                                const haxballDetails = entry.details?.map_id ? getHaxballMap(entry.details.map_id) : null;
                                return (
                                    <article className="profile-history-row" role="listitem" key={`${entry.match_id}-${entry.id}`}>
                                        <div className="profile-history-outcome">
                                            <strong className={getResultClass(entry.result)}>{getResultLabel(lang, entry.result)}</strong>
                                            <time dateTime={entry.played_at}>{formatDateTime(entry.played_at)}</time>
                                        </div>
                                        <div className="profile-history-game">
                                            <strong>{getGameLabel(lang, entry.game)}</strong>
                                            <span>{entry.mode === "ranked" ? t(lang, "profile.ranked") : t(lang, "profile.casual")}</span>
                                            {haxballDetails && <small>{t(lang, `haxball.maps.${haxballDetails.nameKey}`)} · {entry.details?.duration_min} MIN</small>}
                                        </div>
                                        <div className="profile-history-opponents">
                                            <span>{t(lang, "profile.opponents")}</span>
                                            <strong>{entry.opponents.length > 0 ? entry.opponents.join(", ") : t(lang, "profile.no_opponents")}</strong>
                                        </div>
                                        <div className="profile-history-score">
                                            {entry.details?.score ? (
                                                <>
                                                    <span>{t(lang, "profile.score")}</span>
                                                    <strong>{entry.details.score.red} : {entry.details.score.blue}</strong>
                                                </>
                                            ) : entry.elo_delta !== null && entry.elo_delta !== undefined ? (
                                                <>
                                                    <span>{t(lang, "profile.elo_change")}</span>
                                                    <strong className={entry.elo_delta >= 0 ? "is-positive" : "is-negative"}>{formatEloDelta(entry.elo_delta)}</strong>
                                                </>
                                            ) : (
                                                <span className="profile-history-score__empty">—</span>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
                    )}

                    {activeTab === "blocked" && (
                        <section className="game-panel profile-section profile-blocked" aria-labelledby="profile-blocked-title">
                            <div className="profile-section-heading">
                                <div>
                                    <p className="profile-section-kicker"><Ban size={15} aria-hidden="true" />{t(lang, "profile.blocked_kicker")}</p>
                                    <h2 id="profile-blocked-title">{t(lang, "profile.blocked")}</h2>
                                </div>
                                <p>{t(lang, "profile.blocked_hint")}</p>
                            </div>
                            <div className="profile-mockup-notice" role="note">
                                <Ban size={17} aria-hidden="true" />
                                <p>{t(lang, "profile.blocked_mockup_notice")}</p>
                            </div>
                            <p className="profile-blocked-status" aria-live="polite">
                                {unblockedPlayer ? t(lang, "profile.blocked_unblocked").replace("{name}", unblockedPlayer) : ""}
                            </p>
                            {blockedPlayers.length === 0 ? (
                                <div className="profile-blocked-empty" role="status">
                                    <Ban size={22} aria-hidden="true" />
                                    <p>{t(lang, "profile.blocked_empty")}</p>
                                </div>
                            ) : (
                                <div className="profile-blocked-list" role="list">
                                    {blockedPlayers.map((player) => (
                                        <article className="profile-blocked-row" role="listitem" key={player.id}>
                                            <div className="profile-blocked-player">
                                                <ProfileAvatar displayName={player.username} />
                                                <div className="profile-blocked-copy">
                                                    <strong>{player.username}</strong>
                                                    <span>{t(lang, "profile.blocked_at")} · {formatDate(player.blocked_at)}</span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="profile-blocked-action"
                                                onClick={() => handleUnblock(player)}
                                                aria-label={`${t(lang, "profile.unblock")} ${player.username}`}
                                            >
                                                {t(lang, "profile.unblock")}
                                            </button>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </>
        );
    };

    return (
        <main id="main-content" className="game-page-shell profile-shell">
            <ReturnArrow href="/" text={t(lang, "arrow")} />

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

            <div className="game-page-frame profile-frame z-10">
                {userInfo?.isGuest && !isUserLoading ? <AccountRequiredState /> : null}

                {!userInfo?.isGuest && loading && (
                    <div className="profile-loading" role="status" aria-live="polite">
                        <div className="profile-loading__avatar" />
                        <div className="profile-loading__lines"><span /><span /><span /></div>
                        <p>{t(lang, "loading")}</p>
                    </div>
                )}

                {!userInfo?.isGuest && error && (
                    <div className="profile-error" role="alert">
                        <RefreshCw size={22} aria-hidden="true" />
                        <p>{error}</p>
                    </div>
                )}

                {!userInfo?.isGuest && !loading && !error && renderProfile()}
            </div>
        </main>
    );
}

function ProfilePageFallback() {
    const { lang } = useLang();

    return (
        <main id="main-content" className="game-page-shell profile-shell">
            <ReturnArrow href="/" text={t(lang, "arrow")} />
            <div className="game-page-frame profile-frame z-10">
                <div className="profile-loading" role="status" aria-live="polite">
                    <div className="profile-loading__avatar" />
                    <div className="profile-loading__lines"><span /><span /><span /></div>
                    <p>{t(lang, "loading")}</p>
                </div>
            </div>
        </main>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<ProfilePageFallback />}>
            <ProfilePageContent />
        </Suspense>
    );
}

function ActivityIcon() {
    return <span className="profile-section-kicker__icon" aria-hidden="true"><Swords size={15} /></span>;
}

function SummaryCard({ label, value, accent }: { label: string; value: string | number; accent?: "success" }) {
    return (
        <div className={`profile-summary-card${accent ? ` profile-summary-card--${accent}` : ""}`}>
            <strong>{value}</strong>
            <span>{label}</span>
        </div>
    );
}
