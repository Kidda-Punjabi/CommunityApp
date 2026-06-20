export type AdjectiveAgreementOption = {
  punjabi: string;
  romanised: string;
  label: string;
};

export type AdjectiveAgreementQuestion = {
  nounEnglish: string;
  nounGender: "masculine" | "feminine";
  nounNumber: "singular" | "plural";
  adjectiveEnglish: string;
  correctAnswer: string;
  correctRomanised: string;
  options: AdjectiveAgreementOption[];
};

type AdjectiveSet = {
  english: string;
  masculine: { singular: string; plural: string; singularRomanised: string; pluralRomanised: string };
  feminine: { singular: string; plural: string; singularRomanised: string; pluralRomanised: string };
};

const ADJECTIVE_BANK: AdjectiveSet[] = [
  {
    english: "big",
    masculine: {
      singular: "ਵੱਡਾ",
      plural: "ਵੱਡੇ",
      singularRomanised: "vaddaa",
      pluralRomanised: "vadde",
    },
    feminine: {
      singular: "ਵੱਡੀ",
      plural: "ਵੱਡੀਆਂ",
      singularRomanised: "vaddee",
      pluralRomanised: "vaddiyaan",
    },
  },
  {
    english: "small",
    masculine: {
      singular: "ਛੋਟਾ",
      plural: "ਛੋਟੇ",
      singularRomanised: "chhotaa",
      pluralRomanised: "chhote",
    },
    feminine: {
      singular: "ਛੋਟੀ",
      plural: "ਛੋਟੀਆਂ",
      singularRomanised: "chhotee",
      pluralRomanised: "chhotiyaan",
    },
  },
  {
    english: "beautiful",
    masculine: {
      singular: "ਸੋਹਣਾ",
      plural: "ਸੋਹਣੇ",
      singularRomanised: "sohnaa",
      pluralRomanised: "sohne",
    },
    feminine: {
      singular: "ਸੋਹਣੀ",
      plural: "ਸੋਹਣੀਆਂ",
      singularRomanised: "sohnee",
      pluralRomanised: "sohniyaan",
    },
  },
  {
    english: "good",
    masculine: {
      singular: "ਚੰਗਾ",
      plural: "ਚੰਗੇ",
      singularRomanised: "changaa",
      pluralRomanised: "chamge",
    },
    feminine: {
      singular: "ਚੰਗੀ",
      plural: "ਚੰਗੀਆਂ",
      singularRomanised: "changee",
      pluralRomanised: "changiyaan",
    },
  },
];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildAdjectiveAgreementQuestion(
  nounGender: "masculine" | "feminine",
  nounNumber: "singular" | "plural",
  nounEnglish: string
): AdjectiveAgreementQuestion {
  const adjective = ADJECTIVE_BANK[Math.floor(Math.random() * ADJECTIVE_BANK.length)];
  const forms = adjective[nounGender];
  const correctAnswer = nounNumber === "singular" ? forms.singular : forms.plural;
  const correctRomanised =
    nounNumber === "singular" ? forms.singularRomanised : forms.pluralRomanised;

  const allOptions: AdjectiveAgreementOption[] = [
    {
      punjabi: adjective.masculine.singular,
      romanised: adjective.masculine.singularRomanised,
      label: "masculine singular",
    },
    {
      punjabi: adjective.feminine.singular,
      romanised: adjective.feminine.singularRomanised,
      label: "feminine singular",
    },
    {
      punjabi: adjective.masculine.plural,
      romanised: adjective.masculine.pluralRomanised,
      label: "masculine plural",
    },
    {
      punjabi: adjective.feminine.plural,
      romanised: adjective.feminine.pluralRomanised,
      label: "feminine plural",
    },
  ];

  return {
    nounEnglish,
    nounGender,
    nounNumber,
    adjectiveEnglish: adjective.english,
    correctAnswer,
    correctRomanised,
    options: shuffle(allOptions),
  };
}

export const GENDER_SORT_CATEGORY_LABELS: Record<string, string> = {
  food: "Foods",
  foods: "Foods",
  animal: "Animals",
  animals: "Animals",
  household: "Household",
  home: "Household",
  verb: "Verbs",
  verbs: "Verbs",
  body: "Body",
  nature: "Nature",
};

export function nounCategoryTags(nouns: { topic_tags: string[] }[]): { id: string; label: string }[] {
  const tags = new Set<string>();
  for (const noun of nouns) {
    for (const tag of noun.topic_tags ?? []) {
      tags.add(tag.trim().toLowerCase());
    }
  }

  const categories = [...tags]
    .sort()
    .map((tag) => ({
      id: tag,
      label: GENDER_SORT_CATEGORY_LABELS[tag] ?? tag.charAt(0).toUpperCase() + tag.slice(1),
    }));

  return [{ id: "all", label: "Mixed (all categories)" }, ...categories];
}

export function filterNounsByCategory<T extends { topic_tags: string[] }>(
  nouns: T[],
  categoryId: string
): T[] {
  if (categoryId === "all") return nouns;
  return nouns.filter((noun) =>
    (noun.topic_tags ?? []).some((tag) => tag.trim().toLowerCase() === categoryId)
  );
}
