"use client";

import { Bug, Check, History, Sparkles, Wrench, type LucideIcon } from "lucide-react";
import ReturnArrow from "../components/lobby/returnArrow";
import ActiveGameBanner from "../components/lobby/ActiveGameBanner";
import { CHANGELOG_ENTRIES, type ChangelogCategory, type ChangelogEntry } from "../data/changelog";
import { useEffect, useState } from "react";
import { useLang, type Lang } from "../lang";
import { t } from "../i18n";
import { useSocket } from "../hooks/useSocket";

const CATEGORY_CONFIG: Record<ChangelogCategory, { icon: LucideIcon; labelKey: string }> = {
  new: { icon: Sparkles, labelKey: "changelog.categories.new" },
  improved: { icon: Wrench, labelKey: "changelog.categories.improved" },
  fixed: { icon: Bug, labelKey: "changelog.categories.fixed" },
};

function mergeChangelogEntries(dynamicEntries: ChangelogEntry[]) {
  const dynamicKeys = new Set(dynamicEntries.map((entry) => `${entry.date}:${entry.title.en}`));
  const fallbackEntries = CHANGELOG_ENTRIES.filter((entry) => !dynamicKeys.has(`${entry.date}:${entry.title.en}`));
  return [...dynamicEntries, ...fallbackEntries].sort((left, right) => right.date.localeCompare(left.date));
}

function formatDate(date: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === "pl" ? "pl-PL" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export default function ChangelogPage() {
  const { lang } = useLang();
  const { activeGame, setActiveGame } = useSocket();
  const [entries, setEntries] = useState<ChangelogEntry[]>(CHANGELOG_ENTRIES);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/changelog", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !Array.isArray(data?.entries)) return;
        setEntries(mergeChangelogEntries(data.entries as ChangelogEntry[]));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main id="main-content" className="game-page-shell changelog-shell" aria-labelledby="changelog-title">
      <ReturnArrow href="/" text={t(lang, "changelog.back")} />

      {activeGame && (
        <div className="fixed top-12 sm:top-4 left-1/2 -translate-x-1/2 z-50 w-full px-2 sm:px-0 sm:w-auto">
          <ActiveGameBanner
            gameName={activeGame.gameName}
            roomId={activeGame.roomId}
            roomName={activeGame.roomName}
            onDismiss={() => setActiveGame(null)}
          />
        </div>
      )}

      <div className="changelog-frame">
        <header className="changelog-header">
          <p className="changelog-kicker">
            <History size={15} aria-hidden="true" />
            {t(lang, "changelog.kicker")}
          </p>
          <h1 id="changelog-title">{t(lang, "changelog.title")}</h1>
          <p className="changelog-header__subtitle">{t(lang, "changelog.subtitle")}</p>
        </header>

        <section className="changelog-list" aria-label={t(lang, "changelog.timeline_label")}>
          {entries.map((entry, entryIndex) => (
            <article className="changelog-entry" key={entry.date}>
              <div className="changelog-entry__meta">
                {entryIndex === 0 && (
                  <span className="changelog-entry__latest">
                    <Check size={13} aria-hidden="true" />
                    {t(lang, "changelog.latest")}
                  </span>
                )}
                <time dateTime={entry.date}>{formatDate(entry.date, lang)}</time>
              </div>

              <div className="changelog-entry__body">
                <h2>{entry.title[lang]}</h2>
                <p className="changelog-entry__summary">{entry.summary[lang]}</p>

                <div className="changelog-groups">
                  {entry.groups.map((group) => {
                    const config = CATEGORY_CONFIG[group.category];
                    const Icon = config.icon;

                    return (
                      <section className={`changelog-group changelog-group--${group.category}`} key={group.category}>
                        <div className="changelog-group__heading">
                          <span className="changelog-group__icon" aria-hidden="true">
                            <Icon size={16} />
                          </span>
                          <h3>{t(lang, config.labelKey)}</h3>
                        </div>
                        <ul>
                          {group.items.map((item) => (
                            <li key={item[lang]}>{item[lang]}</li>
                          ))}
                        </ul>
                      </section>
                    );
                  })}
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
