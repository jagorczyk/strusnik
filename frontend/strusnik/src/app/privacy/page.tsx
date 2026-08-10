import type { Metadata } from "next";
import LegalPage from "../components/LegalPage";

export const metadata: Metadata = {
  title: "Polityka prywatnosci",
  description: "Informacje o danych przetwarzanych przez serwis Strusnik.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Polityka prywatnosci"
      intro="Informacje o tym, jakie dane przetwarza Strusnik, po co to robi i jakie masz prawa."
    >
      <p className="legal-page-callout">
        To jest podstawowa wersja polityki prywatnosci. Przed formalnym udostepnieniem nalezy uzupelnic dane administratora i adres kontaktowy.
      </p>

      <section>
        <h2>1. Administrator danych</h2>
        <p>
          Administratorem danych zwiazanych z serwisem Strusnik jest operator projektu Strusnik. W sprawach prywatnosci skontaktuj sie z administratorem projektu. Dane identyfikujace administratora i adres kontaktowy nalezy uzupelnic przed formalnym udostepnieniem dokumentu.
        </p>
      </section>

      <section>
        <h2>2. Jakie dane przetwarzamy</h2>
        <ul>
          <li>nazwe uzytkownika, identyfikator konta i dane potrzebne do dzialania profilu;</li>
          <li>haslo zapisane wylacznie w postaci bezpiecznego skrotu;</li>
          <li>identyfikator Google uzywany do rozpoznania polaczonego konta;</li>
          <li>nazwe wyswietlana i avatar, jezeli zostaly przekazane podczas logowania przez Google;</li>
          <li>wyniki, statystyki, relacje znajomych, dane pokoi i tresci wysylane w funkcjach serwisu;</li>
          <li>dane techniczne potrzebne do bezpieczenstwa, obslugi sesji i dzialania aplikacji.</li>
        </ul>
      </section>

      <section>
        <h2>3. Logowanie przez Google</h2>
        <p>
          Logowanie Google korzysta wylacznie z zakresow <strong>openid</strong> i <strong>profile</strong>. Serwis identyfikuje konto po unikalnym identyfikatorze Google i nie uzywa adresu e mail do automatycznego laczenia kont.
        </p>
        <p>
          Adres e mail z konta Google nie jest potrzebny do dzialania tego mechanizmu ani zapisywany jako dane konta Strusnik. Avatar z Google moze zostac zaimportowany jednorazowo do lokalnego formatu, a pozniej mozesz go zmienic albo usunac.
        </p>
      </section>

      <section>
        <h2>4. Cele przetwarzania</h2>
        <p>Dane wykorzystujemy w szczegolnosci do:</p>
        <ul>
          <li>tworzenia kont, logowania i zabezpieczenia sesji;</li>
          <li>zapisywania wynikow, statystyk, znajomych i ustawien profilu;</li>
          <li>zapewnienia dzialania pokoi, czatu i rozgrywek wieloosobowych;</li>
          <li>wykrywania naduzyc, ochrony serwisu i wykonywania obowiazkow prawnych.</li>
        </ul>
      </section>

      <section>
        <h2>5. Cookies i sesja</h2>
        <p>
          Serwis uzywa niezbednych plikow cookie do utrzymania sesji logowania, ochrony przeplywu OAuth i rozpoznania biezacego uzytkownika. Bez tych plikow logowanie i czesc funkcji konta nie bedzie dzialac prawidlowo.
        </p>
        <p>
          Serwis moze rowniez zapisywac w przegladarce techniczne dane potrzebne do dzialania konta goscia oraz preferencji interfejsu.
        </p>
      </section>

      <section>
        <h2>6. Odbiorcy i przechowywanie danych</h2>
        <p>
          Dane sa przetwarzane przez infrastrukture potrzebna do utrzymania Strusnika oraz przez Google w zakresie niezbednym do przeprowadzenia logowania. Nie sprzedajemy danych uzytkownikow.
        </p>
        <p>
          Dane przechowujemy tak dlugo, jak jest to potrzebne do dzialania konta, bezpieczenstwa serwisu i realizacji obowiazkow prawnych. Po usunieciu konta dane sa usuwane albo anonimizowane, z uwzglednieniem kopii zapasowych i uzasadnionych obowiazkow przechowywania.
        </p>
      </section>

      <section>
        <h2>7. Twoje prawa</h2>
        <p>
          W granicach okreslonych prawem mozesz zadac dostepu do swoich danych, ich poprawienia, usuniecia, ograniczenia przetwarzania albo otrzymania kopii danych. Mozesz takze wniesc skarge do wlasciwego organu ochrony danych.
        </p>
        <p>
          Wniosek dotyczacy danych skieruj do administratora projektu na adres kontaktowy podany w finalnej wersji tego dokumentu.
        </p>
      </section>

      <section>
        <h2>8. Aktualizacje polityki</h2>
        <p>
          Polityka moze byc aktualizowana wraz ze zmianami serwisu, prawa albo sposobu przetwarzania danych. Aktualna wersja jest publikowana na tej stronie.
        </p>
      </section>
    </LegalPage>
  );
}
