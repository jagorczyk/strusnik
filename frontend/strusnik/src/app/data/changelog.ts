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
    date: "2026-08-04",
    title: {
      pl: "Nowa rzecz: Haxball",
      en: "New feature: Haxball",
    },
    summary: {
      pl: "Dodano gre Haxball.",
      en: "Added the Haxball game.",
    },
    groups: [
      {
        category: "new",
        items: [
          {
            pl: "Haxball",
            en: "Haxball",
          },
        ],
      },
    ],
  },
];
