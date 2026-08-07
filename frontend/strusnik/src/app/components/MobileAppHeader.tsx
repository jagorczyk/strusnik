"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useLang } from "../lang";
import { t } from "../i18n";

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

function decodeSegment(segment: string | undefined) {
  if (!segment) return "";
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function gameLabel(lang: "pl" | "en", value: string) {
  const key = GAME_LABEL_KEYS[value.toLowerCase()];
  if (!key) return value;
  const translated = t(lang, `games.${key}`);
  return translated.startsWith("games.") ? value : translated;
}

function getRouteInfo(pathname: string, lang: "pl" | "en") {
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0]?.toLowerCase();
  const second = decodeSegment(parts[1]);
  const third = parts[2]?.toLowerCase();

  if (!pathname || pathname === "/") return null;

  if (pathname === "/multiplayer") {
    return { title: t(lang, "home.multi"), backHref: "/", isGame: false };
  }
  if (pathname === "/singleplayer") {
    return { title: t(lang, "home.single"), backHref: "/", isGame: false };
  }
  if (pathname === "/rankings") {
    return { title: t(lang, "home.rankings"), backHref: "/", isGame: false };
  }
  if (pathname === "/profile") {
    return { title: t(lang, "home.profile"), backHref: "/", isGame: false };
  }
  if (pathname === "/settings") {
    return { title: t(lang, "settings.title"), backHref: "/", isGame: false };
  }
  if (pathname === "/changelog") {
    return { title: t(lang, "changelog.title"), backHref: "/", isGame: false };
  }
  if (pathname === "/auth") {
    return { title: t(lang, "logging_in.kicker"), backHref: "/", isGame: false };
  }
  if (pathname === "/admin") {
    return { title: t(lang, "home.admin"), backHref: "/", isGame: false };
  }

  if (first === "lobby" && second) {
    const title = gameLabel(lang, second);
    if (third === "createroom") {
      return { title: t(lang, "rooms.create"), backHref: `/lobby/${encodeURIComponent(second)}`, isGame: false };
    }
    if (third === "queue") {
      return { title: `${title} / ${t(lang, "home.multi")}`, backHref: `/lobby/${encodeURIComponent(second)}`, isGame: false };
    }
    return { title, backHref: "/multiplayer", isGame: false };
  }

  if (first === "games" && second) {
    return {
      title: gameLabel(lang, second),
      backHref: `/lobby/${encodeURIComponent(second)}`,
      isGame: true,
    };
  }

  if (first === "singleplayer" && second) {
    return {
      title: gameLabel(lang, second),
      backHref: "/singleplayer",
      isGame: true,
    };
  }

  return { title: "Strusnik", backHref: "/", isGame: false };
}

export default function MobileAppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { lang } = useLang();
  const routeInfo = getRouteInfo(pathname, lang);

  if (!routeInfo) return null;

  const handleBack = () => {
    // Existing game links own the leave-room lifecycle and confirmation dialog.
    // Triggering the original control keeps that behavior in the shared header.
    const existingReturnLink = document.querySelector<HTMLAnchorElement>(".return-arrow");
    if (existingReturnLink) {
      existingReturnLink.click();
      return;
    }

    router.push(routeInfo.backHref);
  };

  return (
    <header className={`mobile-app-header${routeInfo.isGame ? " mobile-app-header--game" : ""}`}>
      <button
        type="button"
        className="mobile-app-header__back"
        onClick={handleBack}
        aria-label={`${t(lang, "arrow")}: ${routeInfo.title}`}
      >
        <ArrowLeft size={17} strokeWidth={2} aria-hidden="true" />
        <span>{t(lang, "arrow")}</span>
      </button>

      <div className="mobile-app-header__context">
        <span className="mobile-app-header__eyebrow">STRUSNIK</span>
        <strong className="mobile-app-header__title">{routeInfo.title}</strong>
      </div>
    </header>
  );
}
