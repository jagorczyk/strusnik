"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogIn, LogOut, Settings, UserRound, UsersRound } from "lucide-react";
import { useLang } from "../lang";
import { t } from "../i18n";
import { useUser } from "../hooks/useUser";
import { useSocket } from "../hooks/useSocket";
import ProfileAvatar from "./profile/ProfileAvatar";
import FriendsPanel from "./FriendsPanel";

interface ProfileData {
  avatar_url?: string | null;
  multiplayer?: {
    games?: number;
    wins?: number;
    losses?: number;
    win_ratio?: number;
  };
}

export default function ProfileMenu() {
  const { lang } = useLang();
  const { userInfo, isLoading, setUserInfo, updateAvatarUrl } = useUser();
  const { socket } = useSocket();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [pendingFriendCount, setPendingFriendCount] = useState(0);
  const userId = userInfo?.userId;
  const isGuest = userInfo?.isGuest;

  useEffect(() => {
    if (!userId || isGuest) {
      setPendingFriendCount(0);
      return;
    }

    let cancelled = false;
    fetch("/api/friends", { credentials: "include", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { pending_count?: number } | null) => {
        if (!cancelled) setPendingFriendCount(Number(data?.pending_count) || 0);
      })
      .catch(() => {
        if (!cancelled) setPendingFriendCount(0);
      });

    return () => {
      cancelled = true;
    };
  }, [isGuest, userId]);

  useEffect(() => {
    if (!socket || !userId || isGuest) return;
    const updatePendingCount = (data?: { pendingCount?: number }) => {
      if (typeof data?.pendingCount === "number") setPendingFriendCount(data.pendingCount);
    };
    socket.on("friends_updated", updatePendingCount);
    socket.on("friend_request_received", updatePendingCount);
    socket.on("friend_request_accepted", updatePendingCount);
    return () => {
      socket.off("friends_updated", updatePendingCount);
      socket.off("friend_request_received", updatePendingCount);
      socket.off("friend_request_accepted", updatePendingCount);
    };
  }, [isGuest, socket, userId]);

  useEffect(() => {
    if (!isOpen || !userId || isGuest) return;

    let cancelled = false;
    fetch("/api/profile/me", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: ProfileData | null) => {
        if (!cancelled) {
          setProfileData(data);
          updateAvatarUrl(data?.avatar_url ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setProfileData(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, isGuest, updateAvatarUrl, userId]);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setIsFriendsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      setIsFriendsOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const displayName = userInfo?.nickname || (isLoading ? "..." : "Guest");
  const stats = profileData?.multiplayer;
  const statsReady = Boolean(userInfo?.isGuest || profileData);
  const winRatio = stats?.win_ratio ?? 0;
  const avatarUrl = profileData?.avatar_url ?? userInfo?.avatarUrl ?? null;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUserInfo(null);
      setIsOpen(false);
      setIsFriendsOpen(false);
      router.push("/auth");
    }
  };

  if (!userInfo && !isLoading) return null;

  return (
    <div ref={containerRef} className="profile-menu">
      <button
        ref={triggerRef}
        type="button"
        className="profile-menu-trigger touch-target"
        aria-label={t(lang, "profile_menu.open")}
        aria-expanded={isOpen}
        aria-controls="profile-menu-panel"
        onClick={() => {
          setIsOpen((open) => {
            if (open) setIsFriendsOpen(false);
            return !open;
          });
        }}
      >
        <span className="profile-menu-trigger__avatar">
          <ProfileAvatar avatarUrl={userInfo?.avatarUrl} displayName={displayName} />
          {pendingFriendCount > 0 && (
            <span className="profile-menu-trigger__badge" aria-label={`${pendingFriendCount} ${t(lang, "friends.pending")}`}>
              {pendingFriendCount > 99 ? "99+" : pendingFriendCount}
            </span>
          )}
        </span>
        <span className="profile-menu-trigger__name">{displayName}</span>
        <ChevronDown size={15} aria-hidden="true" className={isOpen ? "profile-menu-chevron is-open" : "profile-menu-chevron"} />
      </button>

      {isOpen && (
        <section id="profile-menu-panel" className="profile-menu-panel" aria-label={t(lang, "profile_menu.title")}>
          <header className="profile-menu-header">
            <div className="profile-menu-avatar-area">
              <ProfileAvatar avatarUrl={avatarUrl} displayName={displayName} large />
            </div>
            <div>
              <p className="profile-menu-name">{displayName}</p>
              <p className="profile-menu-meta">
                {userInfo?.isGuest ? t(lang, "profile_menu.guest") : t(lang, "profile_menu.member")}
              </p>
            </div>
          </header>

          <div className="profile-menu-stats" aria-label={t(lang, "profile_menu.stats")}>
            <div className="profile-stat">
              <strong>{statsReady ? (stats?.games ?? 0) : "…"}</strong>
              <span>{t(lang, "profile_menu.games")}</span>
            </div>
            <div className="profile-stat">
              <strong>{statsReady ? (stats?.wins ?? 0) : "…"}</strong>
              <span>{t(lang, "profile_menu.wins")}</span>
            </div>
            <div className="profile-stat">
              <strong>{statsReady ? (stats?.losses ?? 0) : "…"}</strong>
              <span>{t(lang, "profile_menu.losses")}</span>
            </div>
            <div className="profile-stat">
              <strong className="profile-stat-value">{statsReady ? `${winRatio.toFixed(1)}%` : "…"}</strong>
              <span>{t(lang, "profile_menu.win_ratio")}</span>
            </div>
          </div>

          <div className="profile-menu-actions">
            <Link href="/profile" className="profile-menu-link" onClick={() => { setIsOpen(false); setIsFriendsOpen(false); }}>
              <UserRound size={17} aria-hidden="true" />
              <span>{t(lang, "profile_menu.profile")}</span>
            </Link>
            <button
              type="button"
              className="profile-menu-link profile-menu-friends-toggle"
              aria-expanded={isFriendsOpen}
              aria-controls="friends-panel"
              onClick={() => setIsFriendsOpen((open) => !open)}
            >
              <UsersRound size={17} aria-hidden="true" />
              <span>{t(lang, "friends.title")}</span>
              {pendingFriendCount > 0 && (
                <span className="profile-menu-friends-toggle__badge">
                  {pendingFriendCount > 99 ? "99+" : pendingFriendCount}
                </span>
              )}
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={isFriendsOpen ? "profile-menu-friends-toggle__chevron is-open" : "profile-menu-friends-toggle__chevron"}
              />
            </button>
            <Link href="/settings" className="profile-menu-link" onClick={() => { setIsOpen(false); setIsFriendsOpen(false); }}>
              <Settings size={17} aria-hidden="true" />
              <span>{t(lang, "profile_menu.settings")}</span>
            </Link>
            {userInfo?.isGuest ? (
              <Link href="/auth" className="profile-menu-link" onClick={() => { setIsOpen(false); setIsFriendsOpen(false); }}>
                <LogIn size={17} aria-hidden="true" />
                <span>{t(lang, "profile_menu.login")}</span>
              </Link>
            ) : (
              <button type="button" className="profile-menu-link profile-menu-logout" onClick={handleLogout} disabled={isLoggingOut}>
                <LogOut size={17} aria-hidden="true" />
                <span>{isLoggingOut ? t(lang, "loading") : t(lang, "profile_menu.logout")}</span>
              </button>
            )}
          </div>

          <div
            id="friends-panel"
            className={isFriendsOpen ? "friends-panel-reveal is-open" : "friends-panel-reveal"}
            aria-hidden={!isFriendsOpen}
            inert={!isFriendsOpen ? true : undefined}
          >
            <div className="friends-panel-reveal__content">
              <FriendsPanel onPendingCountChange={setPendingFriendCount} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
