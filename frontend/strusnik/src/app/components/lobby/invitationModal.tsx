"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/app/hooks/useSocket";
import { useLang } from "@/app/lang";
import { t } from "@/app/i18n";

interface InvitationData {
  hostName: string;
  gameName: string;
  roomId: string;
  password?: string;
}

export default function InvitationModal() {
  const { socket } = useSocket();
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isCheckingRoom, setIsCheckingRoom] = useState(false);
  const [roomError, setRoomError] = useState("");
  const router = useRouter();
  const { lang } = useLang();

  useEffect(() => {
    if (!socket) return;
    const handleIncoming = (data: InvitationData) => {
      setRoomError("");
      setIsCheckingRoom(false);
      setInvitation(data);
    };
    socket.on("incoming_invite", handleIncoming);
    return () => {
      socket.off("incoming_invite", handleIncoming);
    };
  }, [socket]);

  const handleDecline = () => {
    setInvitation(null);
    setRoomError("");
  };
  const handleAccept = () => {
    if (!invitation || !socket || isCheckingRoom) return;
    setRoomError("");
    setIsCheckingRoom(true);
    socket.emit(
      "validate_invite_room",
      { gameName: invitation.gameName, roomId: invitation.roomId },
      (response: { available?: boolean }) => {
        setIsCheckingRoom(false);
        if (!response?.available) {
          setRoomError(t(lang, "invitation.room_unavailable"));
          return;
        }

        const query = new URLSearchParams({ autojoin: "true" });
        if (invitation.password) query.set("password", invitation.password);
        const gameRoute = invitation.gameName.toLowerCase() === "haxball" ? "haxball" : invitation.gameName;
        router.push(`/games/${gameRoute}/${invitation.roomId}?${query.toString()}`);
        setInvitation(null);
      },
    );
  };

  useEffect(() => {
    if (!invitation) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleDecline();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [invitation]);

  if (!invitation) return null;

  return (
    <div className="mobile-modal-overlay fixed inset-0 z-9999 grid place-items-center bg-black/80 p-4 backdrop-blur-sm" role="presentation">
      <section className="mobile-modal-dialog game-panel w-full max-w-sm text-center" role="dialog" aria-modal="true" aria-labelledby="invitation-title">
        <p className="page-kicker">{t(lang, "invitation.notification")}</p>
        <h2 id="invitation-title" className="mb-6 text-xl font-bold text-[var(--text)]">
          {t(lang, "invitation.contents")}
        </h2>
        <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-4">
          <p className="mb-2 truncate text-lg font-bold text-[var(--text)]">{invitation.hostName}</p>
          <p className="text-xl font-bold text-[var(--amber)]">{invitation.gameName}</p>
        </div>
        {roomError && <p className="mb-4 text-sm text-[var(--danger)]" role="alert">{roomError}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={handleDecline} className="game-secondary-button flex-1" disabled={isCheckingRoom}>
            {t(lang, "invitation.decline")}
          </button>
          <button type="button" onClick={handleAccept} className="game-primary-button flex-1" disabled={isCheckingRoom}>
            {isCheckingRoom ? t(lang, "invitation.checking") : t(lang, "invitation.accept")}
          </button>
        </div>
      </section>
    </div>
  );
}
