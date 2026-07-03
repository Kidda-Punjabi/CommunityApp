const BRIGHTNESS_PUNJABI = /ਚਾਨਣ|ਰੋਸ਼ਨੀ|ਰੋਸ਼ਨ|ਉਜਾਲਾ/u;
const LAMP_PUNJABI = /ਬੱਤੀ|ਦੀਵਾ/u;
const TIGER_PUNJABI = /ਬਾਘ/u;
const LION_PUNJABI = /ਸ਼ੇਰ/u;

function englishHeadword(english: string): string {
  const normalized = english.trim().toLowerCase();
  const firstSegment = normalized.split("/")[0]?.trim() ?? "";
  return firstSegment.split(/\s+/)[0] ?? "";
}

/** Disambiguate homographs (e.g. light = brightness vs lamp) for picture prompts. */
export function resolvePictureMatchIcon(
  english: string,
  punjabi: string,
  storedIcon: string | null | undefined
): string | null {
  const headword = englishHeadword(english);
  const normalizedEnglish = english.trim().toLowerCase();

  if (headword === "light") {
    const hintsLamp = /\b(lamp|bulb|fixture|light bulb)\b/.test(normalizedEnglish);
    const hintsBrightness = /\b(bright|brightness|sunshine|daylight)\b/.test(normalizedEnglish);

    if (LAMP_PUNJABI.test(punjabi) || hintsLamp) return "lamp";
    if (BRIGHTNESS_PUNJABI.test(punjabi) || hintsBrightness) return "sun";
    return "sun";
  }

  const stored = storedIcon?.trim().toLowerCase();
  if (stored === "light") {
    if (LAMP_PUNJABI.test(punjabi)) return "lamp";
    return "sun";
  }

  return stored || null;
}

/** Correct known bad pairings in vocab flashcards used by Picture Match. */
export function applyPictureMatchTextFixes(
  english: string,
  punjabi: string,
  romanised: string | null
): { punjabi: string; romanised: string | null } {
  const headword = englishHeadword(english);

  if (headword === "tiger") {
    if (LION_PUNJABI.test(punjabi) && !TIGER_PUNJABI.test(punjabi)) {
      return { punjabi: "ਬਾਘ", romanised: "baagh" };
    }

    if (TIGER_PUNJABI.test(punjabi) && romanised && /^sher$/i.test(romanised.trim())) {
      return { punjabi, romanised: "baagh" };
    }
  }

  return { punjabi, romanised };
}
