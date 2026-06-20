import type { Verb } from "./types";

const GURMUKHI_PATTERN = /[\u0A00-\u0A7F]/;

/** True when text contains Gurmukhi script (not valid romanisation). */
export function containsGurmukhi(text: string): boolean {
  return GURMUKHI_PATTERN.test(text);
}

/** Return trimmed text only if it is Latin romanisation (no Gurmukhi). */
export function latinRomanised(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const trimmed = text.trim();
  if (containsGurmukhi(trimmed)) return null;
  return trimmed;
}

/** Known irregular simple-past stems → romanised (matches verbs.sql seed). */
export const IRREGULAR_PAST_ROMANISED: Record<string, string> = {
  ਗਿਆ: "gia",
  ਗਈ: "gaee",
  ਗਏ: "gae",
  ਗਈਆਂ: "gaeeaan",
  ਖਾਧਾ: "khaadhaa",
  ਖਾਧੀ: "khaadhee",
  ਖਾਧੇ: "khaadhe",
  ਖਾਧੀਆਂ: "khaadheeaan",
  ਕੀਤਾ: "kitaa",
  ਕੀਤੀ: "kitee",
  ਕੀਤੇ: "kite",
  ਕੀਤੀਆਂ: "kiteeaan",
  ਆਇਆ: "aaiaa",
  ਆਈ: "aaee",
  ਆਏ: "aae",
  ਆਈਆਂ: "aaeeaan",
  ਦਿੱਤਾ: "ditaa",
  ਦਿੱਤੀ: "ditee",
  ਦਿੱਤੇ: "dite",
  ਦਿੱਤੀਆਂ: "diteeaan",
  ਪੀਤਾ: "pitaa",
  ਪੀਤੀ: "pitee",
  ਪੀਤੇ: "pite",
  ਪੀਤੀਆਂ: "piteeaan",
  ਲਿਆ: "liaa",
  ਲਈ: "laee",
  ਲਏ: "lae",
  ਲਈਆਂ: "laeeaan",
  ਕਿਹਾ: "kihaa",
  ਕਹੀ: "kahee",
  ਕਹੇ: "kahe",
  ਕਹੀਆਂ: "kaheeaan",
  ਦੇਖਿਆ: "dekhiaa",
  ਦੇਖੀ: "dekhee",
  ਦੇਖੇ: "dekhe",
  ਦੇਖੀਆਂ: "dekheeaan",
  ਲੱਗਿਆ: "laggiaa",
  ਲੱਗੀ: "laggee",
  ਲੱਗੇ: "lagge",
  ਲੱਗੀਆਂ: "laggeeaan",
};

const HABITUAL_STEM_ROMANISED: Record<string, string> = {
  ਹੁ: "hu",
  ਦਿ: "di",
};

export function irregularPastRomanised(stem: string): string | null {
  return IRREGULAR_PAST_ROMANISED[stem] ?? null;
}

/** Derive Latin root romanisation from infinitive romanisation or verb root. */
export function deriveRootRomanised(verb: Verb): string | null {
  const fromRoot = latinRomanised(verb.rootRomanised);
  if (fromRoot) return fromRoot;

  const fromInfinitive = latinRomanised(verb.infinitiveRomanised);
  if (fromInfinitive) {
    const stripped = fromInfinitive.replace(/(naa|ana|na)$/i, "");
    return stripped || fromInfinitive;
  }

  return null;
}

export function resolveStemRomanised(verb: Verb, stem: string): string {
  const irregular = irregularPastRomanised(stem);
  if (irregular) return irregular;

  const habitual = HABITUAL_STEM_ROMANISED[stem];
  if (habitual) return habitual;

  if (stem === verb.root) {
    return deriveRootRomanised(verb) ?? "";
  }

  if (stem === verb.infinitive) {
    return latinRomanised(verb.infinitiveRomanised) ?? deriveRootRomanised(verb) ?? "";
  }

  if (stem === verb.root + "ੰ") {
    const base = deriveRootRomanised(verb);
    return base ? `${base}n` : "";
  }

  return "";
}

export function resolveEndingRomanised(_ending: string, endingRomanised: string): string {
  return latinRomanised(endingRomanised) ?? "";
}

export function resolvePronounRomanised(romanised: string): string {
  return latinRomanised(romanised) ?? "";
}

export function enrichVerbRomanisation(verb: Verb): Verb {
  const rootRomanised = latinRomanised(verb.rootRomanised) ?? deriveRootRomanised(verb);
  const infinitiveRomanised =
    latinRomanised(verb.infinitiveRomanised) ??
    (rootRomanised ? `${rootRomanised}naa` : null);

  return {
    ...verb,
    rootRomanised,
    infinitiveRomanised,
  };
}
