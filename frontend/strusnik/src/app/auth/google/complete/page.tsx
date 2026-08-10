"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useLang } from "../../../lang";
import { t } from "../../../i18n";

type Payload = {
  code?: string;
  error?: string;
  suggested_username?: string;
  return_to?: string;
};

export default function GoogleAccountSetupPage() {
  const { lang } = useLang();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [pendingError, setPendingError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/google/pending", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as Payload;
        if (cancelled) return;
        if (!response.ok) {
          setError(payload.code === "GOOGLE_ONBOARDING_EXPIRED"
            ? t(lang, "google_onboarding.expired")
            : t(lang, "google_onboarding.generic_error"));
          setPendingError(true);
          setIsLoading(false);
          return;
        }
        setUsername(payload.suggested_username || "");
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(t(lang, "google_onboarding.generic_error"));
        setPendingError(true);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lang]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const normalized = username.trim();
    if (!normalized) {
      setError(t(lang, "google_onboarding.username_required"));
      return;
    }
    if (normalized.length < 3 || normalized.length > 100) {
      setError(t(lang, "google_onboarding.username_invalid"));
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/auth/google/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: normalized }),
      });
      const payload = (await response.json().catch(() => ({}))) as Payload;
      if (!response.ok) {
        setError(payload.code === "USERNAME_TAKEN"
          ? t(lang, "google_onboarding.username_taken")
          : payload.code === "GOOGLE_ONBOARDING_EXPIRED"
            ? t(lang, "google_onboarding.expired")
            : t(lang, "google_onboarding.generic_error"));
        return;
      }

      window.location.assign(payload.return_to || "/");
    } catch {
      setError(t(lang, "google_onboarding.generic_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main id="main-content" className="game-page-shell">
      <div className="auth-shell auth-shell--static">
        <section className="auth-card" aria-labelledby="google-onboarding-title">
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-form-surface">
              <header className="auth-header">
                <p className="auth-kicker">{t(lang, "google_onboarding.kicker")}</p>
                <h1 id="google-onboarding-title" className="auth-title">{t(lang, "google_onboarding.title")}</h1>
                <p className="auth-subtitle">{t(lang, "google_onboarding.subtitle")}</p>
              </header>

              {isLoading ? (
                <p className="auth-feedback" role="status">{t(lang, "loading")}</p>
              ) : pendingError ? (
                <div className="auth-feedback" role="alert">
                  <p className="auth-feedback__error">{error}</p>
                  <Link className="auth-action-button auth-secondary-button" href="/auth">
                    {t(lang, "common.back")}
                  </Link>
                </div>
              ) : (
                <div className="auth-fields">
                  <div className="auth-field">
                    <label htmlFor="google-username">{t(lang, "google_onboarding.username")}</label>
                    <input
                      id="google-username"
                      name="username"
                      type="text"
                      value={username}
                      onChange={(event) => {
                        setUsername(event.target.value);
                        setError("");
                      }}
                      minLength={3}
                      maxLength={100}
                      autoComplete="username"
                      autoFocus
                      className="auth-input"
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? "google-username-error" : "google-username-hint"}
                      disabled={isSaving}
                    />
                    <small id="google-username-hint" className="auth-field-hint">{t(lang, "google_onboarding.username_hint")}</small>
                  </div>
                  {error && <p id="google-username-error" className="auth-feedback__error" role="alert">{error}</p>}
                </div>
              )}
            </div>

            {!isLoading && !pendingError && (
              <div className="auth-actions">
                <button
                  type="submit"
                  className="auth-action-button auth-primary-button touch-target"
                  disabled={isSaving}
                  aria-busy={isSaving}
                >
                  <span>{isSaving ? t(lang, "google_onboarding.loading") : t(lang, "google_onboarding.continue")}</span>
                  {!isSaving && <ArrowRight size={17} aria-hidden="true" />}
                </button>
              </div>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}
