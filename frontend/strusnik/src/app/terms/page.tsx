import type { Metadata } from "next";
import LegalPage from "../components/LegalPage";

export const metadata: Metadata = {
  title: "Regulamin",
  description: "Zasady korzystania z serwisu Strusnik.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Regulamin korzystania z serwisu"
      intro="Zasady korzystania ze Strusnika, kont użytkowników i gier online."
    >
      <p className="legal-page-callout">
        To jest podstawowa wersja regulaminu serwisu. Przed formalnym udostępnieniem należy uzupełnić dane operatora i adres kontaktowy.
      </p>

      <section>
        <h2>1. Postanowienia ogólne</h2>
        <p>
          Strusnik jest serwisem internetowym umożliwiającym grę online, korzystanie z pokoi wieloosobowych, zapisywanie wyników oraz zarządzanie profilem użytkownika.
        </p>
        <p>
          Korzystanie z serwisu oznacza akceptację tego regulaminu. Jeżeli nie akceptujesz jego treści, nie korzystaj z konta ani funkcji wymagających logowania.
        </p>
      </section>

      <section>
        <h2>2. Konto użytkownika</h2>
        <ul>
          <li>Możesz utworzyć konto przy użyciu nazwy użytkownika i hasła albo kontynuować przez Google.</li>
          <li>Podane dane powinny być prawdziwe, aktualne i nie powinny naruszać praw innych osób.</li>
          <li>Za bezpieczeństwo hasła i dostęp do konta odpowiadasz Ty. Nie udostępniaj danych logowania innym osobom.</li>
          <li>Jedno konto nie może służyć do podszywania się pod inną osobę ani do omijania blokad.</li>
        </ul>
      </section>

      <section>
        <h2>3. Zasady korzystania</h2>
        <p>W serwisie nie wolno:</p>
        <ul>
          <li>zakłócać działania serwisu, serwerów ani rozgrywek innych osób;</li>
          <li>wykorzystywać błędów, automatów lub narzędzi dających nieuczciwą przewagę;</li>
          <li>publikować treści bezprawnych, obraźliwych, grożących lub naruszających prawa innych osób;</li>
          <li>podejmować prób uzyskania dostępu do cudzych kont, danych lub usług administracyjnych.</li>
        </ul>
        <p>
          Operator może ograniczyć albo zablokować dostęp do konta, jeżeli jest to potrzebne do ochrony serwisu, użytkowników lub prawidłowego przebiegu rozgrywek.
        </p>
      </section>

      <section>
        <h2>4. Gry i treści użytkowników</h2>
        <p>
          Wyniki, statystyki, nazwy użytkowników i treści wysyłane w ramach funkcji serwisu mogą być widoczne dla innych osób zgodnie z działaniem danej funkcji.
        </p>
        <p>
          Użytkownik ponosi odpowiedzialność za treści, które publikuje lub przesyła. Nie przenosisz na operatora praw do treści, które nie są potrzebne do działania serwisu.
        </p>
      </section>

      <section>
        <h2>5. Dostępność serwisu</h2>
        <p>
          Serwis jest udostępniany bez opłat i może być czasowo niedostępny z powodu prac technicznych, awarii albo przyczyn niezależnych od operatora. Funkcje mogą być rozwijane, zmieniane lub wycofywane.
        </p>
      </section>

      <section>
        <h2>6. Usunięcie konta i zmiany regulaminu</h2>
        <p>
          Możesz usunąć konto w ustawieniach, jeżeli funkcja jest dostępna dla Twojego rodzaju konta. Operator może aktualizować regulamin, a jego nowa wersja będzie publikowana na tej stronie.
        </p>
      </section>

      <section>
        <h2>7. Kontakt</h2>
        <p>
          Pytania dotyczące serwisu i tego regulaminu kieruj do administratora projektu Strusnik. Dane kontaktowe operatora należy uzupełnić przed formalnym udostępnieniem dokumentu.
        </p>
      </section>
    </LegalPage>
  );
}
