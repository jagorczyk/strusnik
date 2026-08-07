"use client";

import { createContext, useEffect, useState, useContext } from "react";
import { io, Socket } from "socket.io-client";
import { UserContext } from "../context/UserContext";
import { useNotification } from "./NotificationsContext";
import { stripPolishDiacritics } from "../utils/copy";
import { useLang } from "../lang";
import { t } from "../i18n";
import SpectatorStrip, { type RoomObserver } from "../components/lobby/SpectatorStrip";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.SOCKET_URL || "http://localhost:5000";
const isTechnicalSocketError = (message: string) => /^(websocket error|transport error|socket error)$/i.test(message.trim());

interface ActiveGameInfo {
    gameName: string;
    roomId: string;
    roomName?: string;
}

interface ActiveGamePayload {
    gameName?: string;
    roomId?: string;
    roomName?: string;
}

export interface RoomPresence {
    roomId: string;
    observers: RoomObserver[];
    observersAllowed: boolean;
    observersCount: number;
    maxObservers: number;
    stage?: string | null;
    hostUserId?: string | null;
    hostId?: string | null;
}

export interface OnlinePlayerSummary {
    userId: string;
    username: string;
    hasAvatar?: boolean;
    status: "available" | "in_lobby" | "in_game";
    gameName: string | null;
    isGuest?: boolean;
}

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    activeGame: ActiveGameInfo | null;
    onlinePlayers: OnlinePlayerSummary[];
    roomPresence: RoomPresence | null;
    setActiveGame: (game: ActiveGameInfo | null) => void;
}

export const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [activeGame, setActiveGame] = useState<ActiveGameInfo | null>(null);
    const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayerSummary[]>([]);
    const [roomPresence, setRoomPresence] = useState<RoomPresence | null>(null);

    const userContext = useContext(UserContext);
    const { notify } = useNotification();
    const { lang } = useLang();

    useEffect(() => {
        const user = userContext?.userInfo;
        if (!user) {
            const resetTimer = window.setTimeout(() => {
                setSocket(null);
                setIsConnected(false);
                setOnlinePlayers([]);
                setRoomPresence(null);
            }, 0);
            return () => window.clearTimeout(resetTimer);
        }

        const newSocket = io(SOCKET_URL, {
            path: "/socket.io",
            transports: ["websocket"],
            autoConnect: true,
            auth: {
                token: String(user.userId),
                username: user.nickname,
                hasAvatar: Boolean(user.avatarUrl),
                avatarUrl: user.avatarUrl ?? null,
            },
        });

        newSocket.on("connect", () => {
            setIsConnected(true);
            newSocket.emit("get_online_players");
        });

        newSocket.on("online_players_update", (players: OnlinePlayerSummary[]) => {
            setOnlinePlayers(players);
        });

        newSocket.on("room_presence_update", (presence: RoomPresence) => {
            setRoomPresence(presence);
        });

        let guestBanNoticeShown = false;
        newSocket.on("connect_error", (error) => {
            setIsConnected(false);
            if (error.message === "GUEST_BANNED" && !guestBanNoticeShown) {
                guestBanNoticeShown = true;
                notify("Ten gosc jest zablokowany.", "error");
            }
        });

        newSocket.on("error", (err: unknown) => {
            let message = "Wystapil blad gniazda";

            if (err && typeof err === "object" && "msg" in err) {
                message = String(err.msg);
            } else if (err && typeof err === "object" && "message" in err) {
                message = String(err.message);
            } else if (typeof err === "string") {
                message = err;
            } else {
                try {
                    message = JSON.stringify(err);
                } catch {
                    message = "Nieznany blad krytyczny";
                }
            }

            if (!isTechnicalSocketError(message)) {
                notify(stripPolishDiacritics(message), "error");
            }
        });

        newSocket.on("disconnect", () => {
            setIsConnected(false);
            setOnlinePlayers([]);
            setRoomPresence(null);
        });

        newSocket.on("error_message", (data: { message: string }) => {
            if (!isTechnicalSocketError(data.message)) {
                notify(stripPolishDiacritics(data.message), "error");
            }
        });

        newSocket.on("notification", (data: { message: string; type?: "info" | "success" }) => {
            notify(stripPolishDiacritics(data.message), data.type || "info");
        });

        newSocket.on("rating_updated", (data: { delta?: number; rating?: number; game?: string }) => {
            const delta = Number(data.delta || 0);
            const prefix = delta > 0 ? "+" : "";
            notify(`ELO ${prefix}${delta} | ${data.rating ?? 500}`, delta >= 0 ? "success" : "info");
        });

        newSocket.on("game_invite", (data: { from: string }) => {
            notify(`Gracz ${data.from} zaprasza Cie do gry!`, "info");
        });

        newSocket.on("friend_request_received", (data: { from?: string }) => {
            notify(t(lang, "friends.notifications.request_received").replace("{name}", data.from || ""), "info");
        });

        newSocket.on("friend_request_accepted", (data: { from?: string }) => {
            notify(t(lang, "friends.notifications.request_accepted").replace("{name}", data.from || ""), "success");
        });

        newSocket.on("player_joined", (data: { username: string }) => {
            notify(`Gracz ${data.username} dolaczyl do pokoju`, "success");
        });

        newSocket.on("player_disconnected", (data: { playerName?: string; waitTime?: number }) => {
            notify(`${data.playerName || 'Gracz'} utracil polaczenie. Oczekiwanie ${data.waitTime || 90} s.`, "info");
        });

        newSocket.on("player_forfeited", (data: { reason?: string }) => {
            notify(data.reason === 'resign' ? 'Gracz poddal gre.' : 'Gracz przegral po utracie polaczenia.', "info");
        });

        newSocket.on("observer_disconnected", (data: { name?: string }) => {
            notify(`${data.name || 'Obserwator'} utracil polaczenie.`, "info");
        });

        newSocket.on("your_active_game", (data: ActiveGamePayload) => {
            if (data && data.roomId && data.gameName) {
                setActiveGame({
                    gameName: data.gameName,
                    roomId: data.roomId,
                    roomName: data.roomName,
                });
            } else {
                setActiveGame(null);
                setRoomPresence(null);
            }
        });

        newSocket.on("game_ended_timeout", () => {
            setActiveGame(null);
            setRoomPresence(null);
        });

        newSocket.on("admin_kick", (data: { user_id: string; reason: string }) => {
            if (String(user.userId) === data.user_id) {
                notify(`Zostales wyrzucony przez administratora: ${data.reason}`, "error");
                setActiveGame(null);
                window.location.href = "/";
            }
        });

        newSocket.on("admin_ban", (data: { user_id: string; reason: string }) => {
            if (String(user.userId) === data.user_id) {
                notify(`Zostales zbanowany: ${data.reason}`, "error");
                setActiveGame(null);
                window.location.href = "/";
            }
        });

        newSocket.on("admin_notice", (data: { user_id?: string | null; message?: string }) => {
            if ((!data.user_id || String(user.userId) === data.user_id) && data.message) {
                notify(data.message, "info");
            }
        });

        // The socket is an external resource created by this effect; publish its handle after setup.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [lang, notify, userContext?.userInfo?.userId]);

    return (
        <SocketContext.Provider value={{ socket, isConnected, activeGame, onlinePlayers, roomPresence, setActiveGame }}>
            {children}
            {activeGame && roomPresence?.roomId === activeGame.roomId && (
                <SpectatorStrip
                    observers={roomPresence.observers}
                    maxObservers={roomPresence.maxObservers}
                />
            )}
        </SocketContext.Provider>
    );
};
