import type { Metadata } from "next";
import LegalPage from "../components/LegalPage";

export const metadata: Metadata = {
  title: "Polityka prywatności",
  description: "Informacje o danych przetwarzanych przez serwis Strusnik.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Polityka prywatności"
      intro="Informacje o tym, jakie dane przetwarza Strusnik, po co to robi i jakie masz prawa."
    >
      <p className="legal-page-callout">
        To jest podstawowa wersja polityki prywatności. Przed formalnym udostępnieniem należy uzupełnić dane administratora i adres kontaktowy.
      </p>

      <section>
        <h2>1. Administrator danych</h2>
        <p>
          Administratorem danych związanych z serwisem Strusnik jest operator projektu Strusnik. W sprawach prywatności skontaktuj się z administratorem projektu. Dane identyfikujące administratora i adres kontaktowy należy uzupełnić przed formalnym udostępnieniem dokumentu.
        </p>
      </section>

      <section>
        <h2>2. Jakie dane przetwarzamy</h2>
        <ul>
          <li>nazwę użytkownika, identyfikator konta i dane potrzebne do działania profilu;</li>
          <li>hasło zapisane wyłącznie w postaci bezpiecznego skrótu;</li>
          <li>identyfikator Google używany do rozpoznania połączonego konta;</li>
          <li>nazwę wyświetlaną i avatar, jeżeli zostały przekazane podczas logowania przez Google;</li>
          <li>wyniki, statystyki, relacje znajomych, dane pokoi i treści wysyłane w funkcjach serwisu;</li>
          <li>dane techniczne potrzebne do bezpieczeństwa, obsługi sesji i działania aplikacji.</li>
        </ul>
      </section>

      <section>
        <h2>3. Logowanie przez Google</h2>
        <p>
          Logowanie Google korzysta wyłącznie z zakresów <strong>openid</strong> i <strong>profile</strong>. Serwis identyfikuje konto po unikalnym identyfikatorze Google i nie używa adresu e mail do automatycznego łączenia kont.
        </p>
        <p>
          Adres e mail z konta Google nie jest potrzebny do działania tego mechanizmu ani zapisywany jako dane konta Strusnik. Avatar z Google może zostać zaimportowany jednorazowo do lokalnego formatu, a później możesz go zmienić albo usunąć.
        </p>
      </section>

      <section>
        <h2>4. Cele przetwarzania</h2>
        <p>Dane wykorzystujemy w szczególności do:</p>
        <ul>
          <li>tworzenia kont, logowania i zabezpieczenia sesji;</li>
          <li>zapisywania wyników, statystyk, znajomych i ustawień profilu;</li>
          <li>zapewnienia działania pokoi, czatu i rozgrywek wieloosobowych;</li>
          <li>wykrywania nadużyć, ochrony serwisu i wykonywania obowiązków prawnych.</li>
        </ul>
      </section>

      <section>
        <h2>5. Cookies i sesja</h2>
        <p>
          Serwis używa niezbędnych plików cookie do utrzymania sesji logowania, ochrony przepływu OAuth i rozpoznania bieżącego użytkownika. Bez tych plików logowanie i część funkcji konta nie będzie działać prawidłowo.
        </p>
        <p>
          Serwis może również zapisywać w przeglądarce techniczne dane potrzebne do działania konta gościa oraz preferencji interfejsu.
        </p>
      </section>

      <section>
        <h2>6. Odbiorcy i przechowywanie danych</h2>
        <p>
          Dane są przetwarzane przez infrastrukturę potrzebną do utrzymania Strusnika oraz przez Google w zakresie niezbędnym do przeprowadzenia logowania. Nie sprzedajemy danych użytkowników.
        </p>
        <p>
          Dane przechowujemy tak długo, jak jest to potrzebne do działania konta, bezpieczeństwa serwisu i realizacji obowiązków prawnych. Po usunięciu konta dane są usuwane albo anonimizowane, z uwzględnieniem kopii zapasowych i uzasadnionych obowiązków przechowywania.
        </p>
      </section>

      <section>
        <h2>7. Twoje prawa</h2>
        <p>
          W granicach określonych prawem możesz żądać dostępu do swoich danych, ich poprawienia, usunięcia, ograniczenia przetwarzania albo otrzymania kopii danych. Możesz także wnieść skargę do właściwego organu ochrony danych.
        </p>
        <p>
          Wniosek dotyczący danych skieruj do administratora projektu na adres kontaktowy podany w finalnej wersji tego dokumentu.
        </p>
      </section>

      <section>
        <h2>8. Aktualizacje polityki</h2>
        <p>
          Polityka może być aktualizowana wraz ze zmianami serwisu, prawa albo sposobu przetwarzania danych. Aktualna wersja jest publikowana na tej stronie.
        </p>
      </section>
    </LegalPage>
  );
}
