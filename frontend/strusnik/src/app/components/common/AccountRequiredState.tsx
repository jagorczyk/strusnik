"use client";

import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { useLang } from "@/app/lang";
import { t } from "@/app/i18n";

type AccountRequiredStateProps = {
  backHref?: string;
  backLabel?: string;
};

export default function AccountRequiredState({ backHref = "/", backLabel }: AccountRequiredStateProps) {
  const { lang } = useLang();
  const titleId = useId();
  const descriptionId = `${titleId}-description`;

  return (
    <section
      className="account-required-state"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className="account-required-state__icon" aria-hidden="true">
        <LockKeyhole size={28} strokeWidth={1.8} />
      </div>

      <div className="account-required-state__copy">
        <p className="account-required-state__eyebrow">{t(lang, "account.kicker")}</p>
        <h1 id={titleId}>{t(lang, "account.title")}</h1>
        <p id={descriptionId}>{t(lang, "account.description")}</p>
      </div>

      <div className="account-required-state__actions">
        <Link className="game-primary-button" href="/auth">
          {t(lang, "account.login")}
        </Link>
        <Link className="game-secondary-button" href={backHref}>
          {backLabel ?? t(lang, "account.back")}
        </Link>
      </div>
    </section>
  );
}
