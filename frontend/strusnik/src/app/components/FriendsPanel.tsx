"use client";

import { Check, Clock3, RotateCw, Search, Send, Trash2, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLang } from "../lang";
import { t } from "../i18n";
import { useSocket } from "../hooks/useSocket";
import { useUser } from "../hooks/useUser";
import AccountRequiredState from "./common/AccountRequiredState";
import ProfileAvatar from "./profile/ProfileAvatar";

interface Friend {
  id: number;
  username: string;
  has_avatar?: boolean;
}

interface FriendRequest {
  id: number;
  user_id: number;
  username: string;
  has_avatar?: boolean;
}

interface FriendsPayload {
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  pending_count: number;
}

interface FriendsPanelProps {
  onPendingCountChange: (count: number) => void;
}

const emptyData: FriendsPayload = {
  friends: [],
  incoming: [],
  outgoing: [],
  pending_count: 0,
};

function avatarUrl(user: { id: number; has_avatar?: boolean }) {
  return user.has_avatar ? `/api/profile/avatar/${user.id}` : null;
}

export default function FriendsPanel({ onPendingCountChange }: FriendsPanelProps) {
  const { lang } = useLang();
  const { userInfo } = useUser();
  const { socket, onlinePlayers, activeGame } = useSocket();
  const [data, setData] = useState<FriendsPayload>(emptyData);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [removeConfirmId, setRemoveConfirmId] = useState<number | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<number>>(new Set());
  const [inviteError, setInviteError] = useState("");

  const isMember = Boolean(userInfo && !userInfo.isGuest);

  const loadFriends = useCallback(async (showLoading = true) => {
    if (!isMember) return;
    if (showLoading) setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/friends", { credentials: "include", cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || t(lang, "friends.load_error"));
      const nextData: FriendsPayload = {
        friends: Array.isArray(payload.friends) ? payload.friends : [],
        incoming: Array.isArray(payload.incoming) ? payload.incoming : [],
        outgoing: Array.isArray(payload.outgoing) ? payload.outgoing : [],
        pending_count: Number(payload.pending_count) || 0,
      };
      setData(nextData);
      onPendingCountChange(nextData.pending_count);
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : t(lang, "friends.load_error"));
    } finally {
      if (showLoading) setIsLoading(false);
      setIsRetrying(false);
    }
  }, [isMember, lang, onPendingCountChange]);

  useEffect(() => {
    if (!isMember) {
      setData(emptyData);
      onPendingCountChange(0);
      return;
    }
    void loadFriends();
  }, [isMember, loadFriends, onPendingCountChange]);

  useEffect(() => {
    if (!socket || !isMember) return;

    const refresh = (payload?: { pendingCount?: number }) => {
      if (typeof payload?.pendingCount === "number") onPendingCountChange(payload.pendingCount);
      void loadFriends(false);
    };

    socket.on("friends_updated", refresh);
    socket.on("friend_request_received", refresh);
    socket.on("friend_request_accepted", refresh);
    return () => {
      socket.off("friends_updated", refresh);
      socket.off("friend_request_received", refresh);
      socket.off("friend_request_accepted", refresh);
    };
  }, [isMember, loadFriends, onPendingCountChange, socket]);

  useEffect(() => {
    if (!socket || !isMember) return;

    const handleInviteSent = (payload: { targetUserId?: string | number }) => {
      const targetId = Number(payload?.targetUserId);
      if (!Number.isInteger(targetId)) return;
      setInvitedIds((current) => new Set(current).add(targetId));
      window.setTimeout(() => {
        setInvitedIds((current) => {
          const next = new Set(current);
          next.delete(targetId);
          return next;
        });
      }, 5000);
    };
    const handleInviteError = (payload: { code?: string }) => {
      const key = `friends.invite_error.${payload?.code || "UNKNOWN"}`;
      setInviteError(t(lang, key));
    };

    socket.on("friend_invite_sent", handleInviteSent);
    socket.on("friend_invite_error", handleInviteError);
    return () => {
      socket.off("friend_invite_sent", handleInviteSent);
      socket.off("friend_invite_error", handleInviteError);
    };
  }, [isMember, lang, socket]);

  useEffect(() => {
    const query = searchDraft.trim();
    if (!isMember || query.length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/friends/search?q=${encodeURIComponent(query)}`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || t(lang, "friends.search_error"));
        setSearchResults(Array.isArray(payload.results) ? payload.results : []);
      } catch (searchError) {
        if (!(searchError instanceof Error && searchError.name === "AbortError")) {
          setSearchResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 260);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isMember, lang, searchDraft]);

  const runAction = async (key: string, url: string, options: RequestInit = {}) => {
    setBusyKey(key);
    setError("");
    try {
      const response = await fetch(url, { ...options, credentials: "include" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || t(lang, "friends.action_error"));
      await loadFriends(false);
      setRemoveConfirmId(null);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t(lang, "friends.action_error"));
    } finally {
      setBusyKey("");
    }
  };

  const presenceById = useMemo(
    () => new Map(onlinePlayers.map((player) => [String(player.userId), player])),
    [onlinePlayers],
  );

  const sortedFriends = useMemo(() => {
    const rank = (friend: Friend) => {
      const status = presenceById.get(String(friend.id))?.status;
      if (status === "available") return 0;
      if (status === "in_lobby" || status === "in_game") return 1;
      return 2;
    };
    return [...data.friends].sort((first, second) => rank(first) - rank(second) || first.username.localeCompare(second.username));
  }, [data.friends, presenceById]);

  const myPresence = onlinePlayers.find((player) => String(player.userId) === String(userInfo?.userId));
  const canInviteToRoom = Boolean(activeGame && myPresence?.status === "in_lobby");

  const handleInvite = (friend: Friend) => {
    if (!socket || !canInviteToRoom || invitedIds.has(friend.id)) return;
    setInviteError("");
    socket.emit("send_friend_invite", { targetUserId: friend.id });
  };

  const retry = () => {
    setIsRetrying(true);
    void loadFriends();
  };

  return (
    <section id="friends-panel" className="friends-panel" aria-label={t(lang, "friends.title")}>
      {!isMember ? (
        <AccountRequiredState />
      ) : (
        <>
          <div className="friends-panel__search">
            <label htmlFor="friends-search">{t(lang, "friends.search_label")}</label>
            <div className="friends-panel__search-row">
              <Search size={16} aria-hidden="true" />
              <input
                id="friends-search"
                type="search"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder={t(lang, "friends.search_placeholder")}
                autoComplete="off"
              />
            </div>
            {searchDraft.trim().length > 0 && searchDraft.trim().length < 3 && (
              <p className="friends-panel__hint">{t(lang, "friends.search_min")}</p>
            )}
            {isSearching && <p className="friends-panel__hint">{t(lang, "friends.searching")}</p>}
            {searchResults.length > 0 && (
              <div className="friends-panel__search-results" role="list" aria-label={t(lang, "friends.search_results")}>
                {searchResults.map((result) => (
                  <div className="friends-panel__row" key={result.id} role="listitem">
                    <ProfileAvatar avatarUrl={avatarUrl(result)} displayName={result.username} />
                    <span className="friends-panel__row-name">{result.username}</span>
                    <button
                      type="button"
                      className="friends-panel__icon-button"
                      onClick={() => void runAction(`request-${result.id}`, "/api/friends/requests", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ recipient_id: result.id }),
                      })}
                      disabled={busyKey === `request-${result.id}`}
                      aria-label={`${t(lang, "friends.send_request")} ${result.username}`}
                      title={t(lang, "friends.send_request")}
                    >
                      {busyKey === `request-${result.id}` ? <Clock3 size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!isSearching && searchDraft.trim().length >= 3 && searchResults.length === 0 && (
              <p className="friends-panel__hint">{t(lang, "friends.search_empty")}</p>
            )}
          </div>

          {error && (
            <div className="friends-panel__error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={retry} disabled={isRetrying}>
                <RotateCw size={14} aria-hidden="true" />
                {t(lang, "friends.retry")}
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="friends-panel__loading" aria-label={t(lang, "friends.loading")}>
              <span /><span /><span />
            </div>
          ) : (
            <>
              {data.incoming.length > 0 && (
                <div className="friends-panel__section">
                  <h3>{t(lang, "friends.incoming")}</h3>
                  {data.incoming.map((request) => (
                    <div className="friends-panel__row" key={request.id}>
                      <ProfileAvatar avatarUrl={avatarUrl(request)} displayName={request.username} />
                      <span className="friends-panel__row-name">{request.username}</span>
                      <div className="friends-panel__row-actions">
                        <button
                          type="button"
                          className="friends-panel__icon-button is-positive"
                          onClick={() => void runAction(`accept-${request.id}`, `/api/friends/requests/${request.id}/accept`, { method: "POST" })}
                          disabled={busyKey === `accept-${request.id}`}
                          aria-label={`${t(lang, "friends.accept")} ${request.username}`}
                          title={t(lang, "friends.accept")}
                        >
                          <Check size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="friends-panel__icon-button is-muted"
                          onClick={() => void runAction(`reject-${request.id}`, `/api/friends/requests/${request.id}/reject`, { method: "POST" })}
                          disabled={busyKey === `reject-${request.id}`}
                          aria-label={`${t(lang, "friends.reject")} ${request.username}`}
                          title={t(lang, "friends.reject")}
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {data.outgoing.length > 0 && (
                <div className="friends-panel__section">
                  <h3>{t(lang, "friends.outgoing")}</h3>
                  {data.outgoing.map((request) => (
                    <div className="friends-panel__row" key={request.id}>
                      <ProfileAvatar avatarUrl={avatarUrl(request)} displayName={request.username} />
                      <span className="friends-panel__row-name">{request.username}</span>
                      <button
                        type="button"
                        className="friends-panel__icon-button is-muted"
                        onClick={() => void runAction(`cancel-${request.id}`, `/api/friends/requests/${request.id}/cancel`, { method: "POST" })}
                        disabled={busyKey === `cancel-${request.id}`}
                        aria-label={`${t(lang, "friends.cancel")} ${request.username}`}
                        title={t(lang, "friends.cancel")}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="friends-panel__section">
                <div className="friends-panel__section-heading">
                  <h3>{t(lang, "friends.list")}</h3>
                  {data.friends.length > 0 && <span>{data.friends.length}</span>}
                </div>
                {sortedFriends.length === 0 ? (
                  <p className="friends-panel__empty">{t(lang, "friends.empty")}</p>
                ) : (
                  sortedFriends.map((friend) => {
                    const presence = presenceById.get(String(friend.id));
                    const status = presence?.status || "offline";
                    const isInviteSent = invitedIds.has(friend.id);
                    const isRemoving = busyKey === `remove-${friend.id}`;
                    return (
                      <div className="friends-panel__row" key={friend.id}>
                        <span className={`friends-panel__status friends-panel__status--${status}`} aria-hidden="true" />
                        <ProfileAvatar avatarUrl={avatarUrl(friend)} displayName={friend.username} />
                        <div className="friends-panel__row-copy">
                          <span className="friends-panel__row-name">{friend.username}</span>
                          <span className="friends-panel__row-status">{t(lang, `friends.status.${status}`)}</span>
                        </div>
                        {removeConfirmId === friend.id ? (
                          <div className="friends-panel__row-actions">
                            <button
                              type="button"
                              className="friends-panel__confirm-remove"
                              onClick={() => void runAction(`remove-${friend.id}`, `/api/friends/${friend.id}`, { method: "DELETE" })}
                              disabled={isRemoving}
                            >
                              {t(lang, "friends.remove_confirm")}
                            </button>
                            <button
                              type="button"
                              className="friends-panel__icon-button is-muted"
                              onClick={() => setRemoveConfirmId(null)}
                              aria-label={t(lang, "friends.cancel")}
                              title={t(lang, "friends.cancel")}
                            >
                              <X size={16} aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          <div className="friends-panel__row-actions">
                            {canInviteToRoom && status === "available" && (
                              <button
                                type="button"
                                className={`friends-panel__icon-button is-invite${isInviteSent ? " is-sent" : ""}`}
                                onClick={() => handleInvite(friend)}
                                disabled={isInviteSent}
                                aria-label={isInviteSent ? t(lang, "friends.invite_sent") : `${t(lang, "friends.invite")} ${friend.username}`}
                                title={isInviteSent ? t(lang, "friends.invite_sent") : t(lang, "friends.invite")}
                              >
                                {isInviteSent ? <Check size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                              </button>
                            )}
                            <button
                              type="button"
                              className="friends-panel__icon-button is-muted"
                              onClick={() => setRemoveConfirmId(friend.id)}
                              aria-label={`${t(lang, "friends.remove")} ${friend.username}`}
                              title={t(lang, "friends.remove")}
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                {data.friends.length > 0 && !canInviteToRoom && (
                  <p className="friends-panel__hint">{t(lang, "friends.room_hint")}</p>
                )}
              </div>

              {inviteError && <p className="friends-panel__error" role="alert">{inviteError}</p>}
            </>
          )}
        </>
      )}
    </section>
  );
}
