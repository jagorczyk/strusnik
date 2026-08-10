import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

type LegalPageProps = {
  title: string;
  intro: string;
  children: React.ReactNode;
};

export default function LegalPage({ title, intro, children }: LegalPageProps) {
  return (
    <main id="main-content" className="game-page-shell legal-page-shell">
      <article className="legal-page-card" aria-labelledby="legal-page-title">
        <header className="legal-page-header">
          <div className="legal-page-meta">
            <span className="page-kicker">STRUSNIK / INFORMACJE</span>
            <ShieldCheck size={18} aria-hidden="true" />
          </div>
          <h1 id="legal-page-title">{title}</h1>
          <p>{intro}</p>
        </header>

        <div className="legal-page-content">{children}</div>

        <nav className="legal-page-nav" aria-label="Dokumenty serwisu">
          <Link className="legal-page-nav__back" href="/">
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Wroc do Strusnika</span>
          </Link>
          <div className="legal-page-nav__links">
            <Link href="/terms">Regulamin</Link>
            <Link href="/privacy">Polityka prywatnosci</Link>
          </div>
        </nav>
      </article>
    </main>
  );
}
