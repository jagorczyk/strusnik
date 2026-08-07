"use client";

import React, { useEffect, useRef, useState } from "react";
import { useLang } from "@/app/lang";
import { t } from "@/app/i18n";

interface PasswordModalProps {
  isOpen: boolean;
  gameName: string;
  errorMessage: string;
  onSubmit: (password: string) => void;
  onClose: () => void;
}

export default function PasswordModal({
  isOpen,
  errorMessage,
  onSubmit,
  onClose,
}: PasswordModalProps) {
  const [password, setPassword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { lang } = useLang();

  useEffect(() => {
    if (!isOpen) return;
    const resetTimer = window.setTimeout(() => setPassword(""), 0);
    inputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(resetTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(password);
  };

  return (
    <div className="mobile-modal-overlay fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm" role="presentation">
      <form
        className="mobile-modal-dialog game-panel w-full max-w-sm text-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-dialog-title"
        onSubmit={handleSubmit}
      >
        <p className="page-kicker">{t(lang, "rooms.private")}</p>
        <h2 id="password-dialog-title" className="mb-2 text-xl font-bold text-[var(--text)]">
          {t(lang, "rooms.authentication")}
        </h2>
        <p className="mb-6 text-sm text-[var(--muted)]">{t(lang, "rooms.password")}</p>

        <label htmlFor="room-password" className="mb-2 block text-left text-sm font-semibold text-[var(--text)]">
          {t(lang, "rooms.password")}
        </label>
        <input
          ref={inputRef}
          id="room-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(errorMessage)}
          aria-describedby={errorMessage ? "room-password-error" : undefined}
          className="mb-4 w-full px-3"
        />

        {errorMessage && (
          <p id="room-password-error" className="mb-4 text-sm text-[var(--danger)]" role="alert">
            {errorMessage}
          </p>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="game-secondary-button flex-1">
            {t(lang, "rooms.cancel")}
          </button>
          <button type="submit" className="game-primary-button flex-1">
            {t(lang, "rooms.join")}
          </button>
        </div>
      </form>
    </div>
  );
}
