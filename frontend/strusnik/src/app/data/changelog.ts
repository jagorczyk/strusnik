export type ChangelogCategory = "new" | "improved" | "fixed";

type LocalizedCopy = {
  pl: string;
  en: string;
};

export type ChangelogGroup = {
  category: ChangelogCategory;
  items: LocalizedCopy[];
};

export type ChangelogEntry = {
  date: string;
  title: LocalizedCopy;
  summary: LocalizedCopy;
  groups: ChangelogGroup[];
};

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    date: "2026-08-03",
    title: {
      pl: "Szybszy start i lżejsze widoki",
      en: "A faster start with lighter screens",
    },
    summary: {
      pl: "Zoptymalizowaliśmy obrazy i uporządkowaliśmy lobby, żeby szybciej przejść od strony głównej do gry.",
      en: "We optimized images and refined the lobby so you can get from the home page to a game faster.",
    },
    groups: [
      {
        category: "new",
        items: [
          {
            pl: "Dodano podgląd strony przy udostępnianiu linku w komunikatorach.",
            en: "Added a page preview when sharing a link in messaging apps.",
          },
        ],
      },
      {
        category: "improved",
        items: [
          {
            pl: "Karty gier korzystają z lżejszych obrazów i wczytują się szybciej.",
            en: "Game cards now use lighter images and load faster.",
          },
          {
            pl: "Widoki Haxballa lepiej dopasowują się do ekranów telefonów.",
            en: "Haxball screens now fit phone displays more naturally.",
          },
        ],
      },
      {
        category: "fixed",
        items: [
          {
            pl: "Usunięto rozciągnięty ekran startowy z lobby Haxballa.",
            en: "Removed the stretched splash screen from the Haxball lobby.",
          },
        ],
      },
    ],
  },
  {
    date: "2026-08-02",
    title: {
      pl: "Więcej sposobów na wspólną grę",
      en: "More ways to play together",
    },
    summary: {
      pl: "Profile, znajomi i rankingi pomagają wrócić do rywalizacji.",
      en: "Profiles, friends, and rankings make it easier to return to the competition.",
    },
    groups: [
      {
        category: "new",
        items: [
          {
            pl: "Dodano znajomych i zaproszenia do wspólnej rozgrywki.",
            en: "Added friends and invitations to multiplayer games.",
          },
          {
            pl: "Dodano Haxballa z mapami, drużynami i sterowaniem dotykowym.",
            en: "Added Haxball with maps, teams, and touch controls.",
          },
        ],
      },
      {
        category: "improved",
        items: [
          {
            pl: "Rankingi są dostępne także dla gości.",
            en: "Rankings are now available to guests too.",
          },
          {
            pl: "Statystyki multiplayer i singleplayer są czytelniejsze w profilu.",
            en: "Multiplayer and singleplayer stats are clearer in the profile.",
          },
        ],
      },
      {
        category: "fixed",
        items: [
          {
            pl: "Poprawiono karty gier, statystyki mobilne oraz ponowne łączenie.",
            en: "Fixed game cards, mobile stats, and reconnection behavior.",
          },
        ],
      },
    ],
  },
];
