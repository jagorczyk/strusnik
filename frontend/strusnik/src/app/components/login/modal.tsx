"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { LogIn, UserPlus, UsersRound } from "lucide-react";
import { useLang } from "@/app/lang";
import { t } from "@/app/i18n";
import { useNotification } from "@/app/context/NotificationsContext";
import { useFetchWithNotify } from "@/app/hooks/useFetchWithNotify";
import { getOrCreateGuestIdentity } from "@/app/utils/guest";

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M21.35 12.27c0-.77-.07-1.51-.22-2.22H12v4.2h5.24a4.48 4.48 0 0 1-1.95 2.94v2.45h3.16c1.85-1.7 2.9-4.2 2.9-7.37Z" />
      <path fill="#34A853" d="M12 21.7c2.65 0 4.88-.88 6.5-2.38l-3.16-2.45c-.88.59-2 .94-3.34.94-2.56 0-4.73-1.73-5.5-4.06H3.24v2.53A9.82 9.82 0 0 0 12 21.7Z" />
      <path fill="#FBBC05" d="M6.5 13.75a5.9 5.9 0 0 1 0-3.5V7.72H3.24a9.7 9.7 0 0 0 0 8.56l3.26-2.53Z" />
      <path fill="#EA4335" d="M12 6.2c1.44 0 2.73.5 3.75 1.48l2.82-2.82C16.87 3.3 14.64 2.3 12 2.3a9.82 9.82 0 0 0-8.76 5.42L6.5 10.25C7.27 7.92 9.44 6.2 12 6.2Z" />
    </svg>
  );
}

export default function LoginModal() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { lang } = useLang();
  const { notify } = useNotification();
  const fetchWithNotify = useFetchWithNotify();

  useEffect(() => {
    const googleError = new URLSearchParams(window.location.search).get("google_error");
    if (!googleError) return;
    const timer = window.setTimeout(() => {
      setError(t(lang, "logging_in.google_error"));
      window.history.replaceState({}, "", "/auth");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [lang]);

  const handleGoogleLogin = () => {
    setError("");
    setSuccess("");
    setIsLoading(true);
    window.location.assign("/api/auth/google/start?mode=login&return_to=%2F");
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const username = formData.get("username");
    const password = formData.get("password");

    const data = await fetchWithNotify("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      credentials: "include",
    });

    if (!data) {
      setIsLoading(false);
      return;
    }

    notify(t(lang, "logging_in.success"), "success");
    window.location.href = "/";
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const username = formData.get("username");
    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");

    if (password !== confirmPassword) {
      const message = t(lang, "logging_in.passwords_dont_match");
      setError(message);
      notify(message, "warning");
      setIsLoading(false);
      return;
    }

    const data = await fetchWithNotify("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (!data) {
      setIsLoading(false);
      return;
    }

    const successMessage = t(lang, "logging_in.register_success");
    setSuccess(successMessage);
    notify(successMessage, "success");
    setIsRegisterMode(false);
    setIsLoading(false);
  };

  const handleGuestLogin = () => {
    const guest = getOrCreateGuestIdentity();
    notify(`${t(lang, "logging_in.guest")} · ${guest.name}`, "info");
    router.push("/");
  };

  const toggleMode = () => {
    setIsRegisterMode((mode) => !mode);
    setError("");
    setSuccess("");
  };

  const submitLabel = isRegisterMode ? t(lang, "logging_in.register") : t(lang, "logging_in.login");
  const loadingLabel = isRegisterMode
    ? t(lang, "logging_in.loading_register")
    : t(lang, "logging_in.loading_login");

  return (
    <div className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <form
          id="auth-form"
          onSubmit={isRegisterMode ? handleRegister : handleLogin}
          className="auth-form"
        >
          <div className="auth-form-surface">
            <header className="auth-header">
              <p className="auth-kicker">{t(lang, "logging_in.kicker")}</p>
              <h1 id="auth-title" className="auth-title">
                {isRegisterMode ? t(lang, "logging_in.register_title") : t(lang, "logging_in.greeting")}
              </h1>
              <p className="auth-subtitle">
                {isRegisterMode ? t(lang, "logging_in.register_subtitle") : t(lang, "logging_in.login_subtitle")}
              </p>
            </header>

            <div className="auth-fields">
              <div className="auth-field">
                <label htmlFor="auth-username">{t(lang, "logging_in.name")}</label>
                <input
                  id="auth-username"
                  type="text"
                  name="username"
                  autoComplete="username"
                  required
                  minLength={3}
                  className="auth-input"
                />
              </div>

              <div className="auth-field">
                <label htmlFor="auth-password">{t(lang, "logging_in.password")}</label>
                <input
                  id="auth-password"
                  type="password"
                  name="password"
                  autoComplete={isRegisterMode ? "new-password" : "current-password"}
                  required
                  minLength={8}
                  className="auth-input"
                />
              </div>

              {isRegisterMode && (
                <div className="auth-field">
                  <label htmlFor="auth-confirm-password">{t(lang, "logging_in.confirm_password")}</label>
                  <input
                    id="auth-confirm-password"
                    type="password"
                    name="confirmPassword"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="auth-input"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "auth-form-error" : undefined}
                  />
                </div>
              )}

              {(error || success) && (
                <div className="auth-feedback" aria-live="polite">
                  {error && <p id="auth-form-error" className="auth-feedback__error" role="alert">{error}</p>}
                  {success && <p className="auth-feedback__success" role="status">{success}</p>}
                </div>
              )}
            </div>
          </div>

          <div className="auth-actions">
            <div className="auth-action-row">
              <button
                type="submit"
                disabled={isLoading}
                className="auth-action-button auth-primary-button touch-target"
                aria-busy={isLoading}
              >
                {isLoading ? <span>{loadingLabel}</span> : <LogIn size={17} aria-hidden="true" />}
                <span>{isLoading ? "" : submitLabel}</span>
              </button>

              <button
                type="button"
                onClick={toggleMode}
                aria-label={isRegisterMode ? t(lang, "logging_in.back_to_login") : t(lang, "logging_in.register")}
                aria-controls="auth-form"
                disabled={isLoading}
                className="auth-action-button auth-secondary-button touch-target"
              >
                {isRegisterMode ? <LogIn size={17} aria-hidden="true" /> : <UserPlus size={17} aria-hidden="true" />}
                <span>{isRegisterMode ? t(lang, "logging_in.back_to_login") : t(lang, "logging_in.register")}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="google-entry-button touch-target"
              aria-busy={isLoading}
            >
              <GoogleMark />
              <span>{isLoading ? t(lang, "logging_in.loading_google") : t(lang, "logging_in.continue_google")}</span>
            </button>

            <div className="auth-divider" aria-hidden="true">
              <span>{t(lang, "logging_in.or")}</span>
            </div>

            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={isLoading}
              className="guest-entry-button touch-target"
            >
              <UsersRound size={17} aria-hidden="true" />
              <span>{t(lang, "logging_in.guest")}</span>
            </button>

            <p className="auth-legal-copy">
              Korzystając z konta, akceptujesz <Link href="/terms">Regulamin</Link> i zapoznajesz się z <Link href="/privacy">Polityką prywatności</Link>.
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}
