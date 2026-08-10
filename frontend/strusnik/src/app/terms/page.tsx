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
      intro="Zasady korzystania ze Strusnika, kont uzytkownikow i gier online."
    >
      <p className="legal-page-callout">
        To jest podstawowa wersja regulaminu serwisu. Przed formalnym udostepnieniem nalezy uzupelnic dane operatora i adres kontaktowy.
      </p>

      <section>
        <h2>1. Postanowienia ogolne</h2>
        <p>
          Strusnik jest serwisem internetowym umozliwiajacym gre online, korzystanie z pokoi wieloosobowych, zapisywanie wynikow oraz zarzadzanie profilem uzytkownika.
        </p>
        <p>
          Korzystanie z serwisu oznacza akceptacje tego regulaminu. Jezeli nie akceptujesz jego tresci, nie korzystaj z konta ani funkcji wymagajacych logowania.
        </p>
      </section>

      <section>
        <h2>2. Konto uzytkownika</h2>
        <ul>
          <li>Mozesz utworzyc konto przy uzyciu nazwy uzytkownika i hasla albo kontynuowac przez Google.</li>
          <li>Podane dane powinny byc prawdziwe, aktualne i nie powinny naruszac praw innych osob.</li>
          <li>Za bezpieczenstwo hasla i dostep do konta odpowiadasz Ty. Nie udostepniaj danych logowania innym osobom.</li>
          <li>Jedno konto nie moze sluzyc do podszywania sie pod inna osobe ani do omijania blokad.</li>
        </ul>
      </section>

      <section>
        <h2>3. Zasady korzystania</h2>
        <p>W serwisie nie wolno:</p>
        <ul>
          <li>zaklocac dzialania serwisu, serwerow ani rozgrywek innych osob;</li>
          <li>wykorzystywac bledow, automatow lub narzedzi dajacych nieuczciwa przewage;</li>
          <li>publikowac tresci bezprawnych, obrazliwych, grozacych lub naruszajacych prawa innych osob;</li>
          <li>podejmowac prob uzyskania dostepu do cudzych kont, danych lub uslug administracyjnych.</li>
        </ul>
        <p>
          Operator moze ograniczyc albo zablokowac dostep do konta, jezeli jest to potrzebne do ochrony serwisu, uzytkownikow lub prawidlowego przebiegu rozgrywek.
        </p>
      </section>

      <section>
        <h2>4. Gry i tresci uzytkownikow</h2>
        <p>
          Wyniki, statystyki, nazwy uzytkownikow i tresci wysylane w ramach funkcji serwisu moga byc widoczne dla innych osob zgodnie z dzialaniem danej funkcji.
        </p>
        <p>
          Uzytkownik ponosi odpowiedzialnosc za tresci, ktore publikuje lub przesyla. Nie przenosisz na operatora praw do tresci, ktore nie sa potrzebne do dzialania serwisu.
        </p>
      </section>

      <section>
        <h2>5. Dostepnosc serwisu</h2>
        <p>
          Serwis jest udostepniany bez oplat i moze byc czasowo niedostepny z powodu prac technicznych, awarii albo przyczyn niezaleznych od operatora. Funkcje moga byc rozwijane, zmieniane lub wycofywane.
        </p>
      </section>

      <section>
        <h2>6. Usuniecie konta i zmiany regulaminu</h2>
        <p>
          Mozesz usunac konto w ustawieniach, jezeli funkcja jest dostepna dla Twojego rodzaju konta. Operator moze aktualizowac regulamin, a jego nowa wersja bedzie publikowana na tej stronie.
        </p>
      </section>

      <section>
        <h2>7. Kontakt</h2>
        <p>
          Pytania dotyczace serwisu i tego regulaminu kieruj do administratora projektu Strusnik. Dane kontaktowe operatora nalezy uzupelnic przed formalnym udostepnieniem dokumentu.
        </p>
      </section>
    </LegalPage>
  );
}
