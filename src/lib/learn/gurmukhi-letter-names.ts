/** Foundational Course letter / matra / syllable names shown beside quiz options. */

const LETTER_NAMES: Record<string, string> = {
  "ੳ": "Oora",
  ਅ: "Airaa",
  "ੲ": "Eeree",
  ਸ: "Sassa",
  ਹ: "Hahaa",
  ਕ: "Kakka",
  ਖ: "Khakha",
  ਗ: "Gagga",
  ਘ: "Ghaggha",
  ਙ: "Nganga",
  ਚ: "Chachaa",
  ਛ: "Chhachha",
  ਜ: "Jajja",
  ਝ: "Jhajha",
  ਞ: "Nyanya",
  ਟ: "Tainka",
  ਠ: "Thathaa",
  ਡ: "Duddaa",
  ਢ: "Dhuddaa",
  ਣ: "Nannaa",
  ਤ: "Tataa",
  ਥ: "Thathhaa",
  ਦ: "Dadaa",
  ਧ: "Dhadhhaa",
  ਨ: "Nannaa",
  ਪ: "Pappaa",
  ਫ: "Phapphaa",
  ਬ: "Babbhaa",
  ਭ: "Bhabbhaa",
  ਮ: "Mammaa",
  ਯ: "Yayyaa",
  ਰ: "Raraa",
  ਲ: "Lallaa",
  ਵ: "Vavaa",
  "ੜ": "Rarrhaa",
};

const SYLLABLE_NAMES: Record<string, string> = {
  ਕਾ: "kaa",
  ਕਿ: "ki",
  ਕੀ: "kee",
  ਕੁ: "ku",
  ਕੂ: "koo",
  ਕੇ: "ke",
  ਕੈ: "kai",
  ਕੋ: "ko",
  ਕੌ: "kau",
};

const MATRA_NAMES: Record<string, string> = {
  "ਾ": "aa (Kanna)",
  "ਿ": "i (Sihari)",
  "ੀ": "ee (Bihari)",
  "ੁ": "u (Aunkar)",
  "ੂ": "oo (Dulainkar)",
  "ੇ": "e (Lanv)",
  "ੈ": "ai (Dulavan)",
  "ੋ": "o (Hora)",
  "ੌ": "au (Kanaura)",
};

export function gurmukhiOptionName(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  return (
    LETTER_NAMES[trimmed] ??
    SYLLABLE_NAMES[trimmed] ??
    MATRA_NAMES[trimmed] ??
    null
  );
}
