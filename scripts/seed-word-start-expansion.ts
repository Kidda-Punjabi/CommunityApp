/**
 * Insert extra Sound Match / Word Start words (no audio yet).
 * Then run: npx tsx scripts/generate-word-start-audio.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type SeedWord = {
  word_gurmukhi: string;
  meaning_english: string;
  romanised: string;
  starting_letter: string;
  distractor_letters: string[];
  display_order: number;
};

const NEW_WORDS: SeedWord[] = [
  { word_gurmukhi: "ਖਾਣਾ", meaning_english: "food", romanised: "khaana", starting_letter: "ਖ", distractor_letters: ["ਕ", "ਗ"], display_order: 31 },
  { word_gurmukhi: "ਖੇਡ", meaning_english: "game", romanised: "khed", starting_letter: "ਖ", distractor_letters: ["ਕ", "ਘ"], display_order: 32 },
  { word_gurmukhi: "ਖਿੜਕੀ", meaning_english: "window", romanised: "khidki", starting_letter: "ਖ", distractor_letters: ["ਕ", "ਗ"], display_order: 33 },
  { word_gurmukhi: "ਖੇਤ", meaning_english: "field", romanised: "khet", starting_letter: "ਖ", distractor_letters: ["ਕ", "ਚ"], display_order: 34 },
  { word_gurmukhi: "ਚਾਬੀ", meaning_english: "key", romanised: "chaabi", starting_letter: "ਚ", distractor_letters: ["ਛ", "ਜ"], display_order: 35 },
  { word_gurmukhi: "ਚੰਦ", meaning_english: "moon", romanised: "chand", starting_letter: "ਚ", distractor_letters: ["ਛ", "ਕ"], display_order: 36 },
  { word_gurmukhi: "ਛਾਲ", meaning_english: "jump", romanised: "chhaal", starting_letter: "ਛ", distractor_letters: ["ਚ", "ਝ"], display_order: 37 },
  { word_gurmukhi: "ਛਾਤੀ", meaning_english: "chest", romanised: "chhati", starting_letter: "ਛ", distractor_letters: ["ਚ", "ਜ"], display_order: 38 },
  { word_gurmukhi: "ਟੋਪੀ", meaning_english: "cap", romanised: "topi", starting_letter: "ਟ", distractor_letters: ["ਠ", "ਤ"], display_order: 39 },
  { word_gurmukhi: "ਟਮਾਟਰ", meaning_english: "tomato", romanised: "tamatar", starting_letter: "ਟ", distractor_letters: ["ਠ", "ਤ"], display_order: 40 },
  { word_gurmukhi: "ਟੋਕਰੀ", meaning_english: "basket", romanised: "tokri", starting_letter: "ਟ", distractor_letters: ["ਠ", "ਡ"], display_order: 41 },
  { word_gurmukhi: "ਠੀਕ", meaning_english: "okay", romanised: "theek", starting_letter: "ਠ", distractor_letters: ["ਟ", "ਥ"], display_order: 42 },
  { word_gurmukhi: "ਠਾਣਾ", meaning_english: "police station", romanised: "thaana", starting_letter: "ਠ", distractor_letters: ["ਟ", "ਤ"], display_order: 43 },
  { word_gurmukhi: "ਠੋਡੀ", meaning_english: "chin", romanised: "thodi", starting_letter: "ਠ", distractor_letters: ["ਟ", "ਥ"], display_order: 44 },
  { word_gurmukhi: "ਤਾਰਾ", meaning_english: "star", romanised: "taara", starting_letter: "ਤ", distractor_letters: ["ਥ", "ਟ"], display_order: 45 },
  { word_gurmukhi: "ਤੇਲ", meaning_english: "oil", romanised: "tel", starting_letter: "ਤ", distractor_letters: ["ਥ", "ਦ"], display_order: 46 },
  { word_gurmukhi: "ਤਿੰਨ", meaning_english: "three", romanised: "tinn", starting_letter: "ਤ", distractor_letters: ["ਥ", "ਟ"], display_order: 47 },
  { word_gurmukhi: "ਥਾਲ", meaning_english: "platter", romanised: "thaal", starting_letter: "ਥ", distractor_letters: ["ਤ", "ਠ"], display_order: 48 },
  { word_gurmukhi: "ਥਾਂ", meaning_english: "place", romanised: "thaan", starting_letter: "ਥ", distractor_letters: ["ਤ", "ਠ"], display_order: 49 },
  { word_gurmukhi: "ਥੱਪੜ", meaning_english: "slap", romanised: "thappar", starting_letter: "ਥ", distractor_letters: ["ਤ", "ਠ"], display_order: 50 },
  { word_gurmukhi: "ਪਿਤਾ", meaning_english: "father", romanised: "pita", starting_letter: "ਪ", distractor_letters: ["ਫ", "ਬ"], display_order: 51 },
  { word_gurmukhi: "ਪੱਤਾ", meaning_english: "leaf", romanised: "patta", starting_letter: "ਪ", distractor_letters: ["ਫ", "ਬ"], display_order: 52 },
  { word_gurmukhi: "ਫੁੱਲ", meaning_english: "flower", romanised: "phull", starting_letter: "ਫ", distractor_letters: ["ਪ", "ਭ"], display_order: 53 },
  { word_gurmukhi: "ਫੁੱਗਾ", meaning_english: "balloon", romanised: "phugga", starting_letter: "ਫ", distractor_letters: ["ਪ", "ਬ"], display_order: 54 },
  { word_gurmukhi: "ਫੌਜ", meaning_english: "army", romanised: "fauj", starting_letter: "ਫ", distractor_letters: ["ਪ", "ਭ"], display_order: 55 },
  { word_gurmukhi: "ਗਾਂ", meaning_english: "cow", romanised: "gaa", starting_letter: "ਗ", distractor_letters: ["ਘ", "ਕ"], display_order: 56 },
  { word_gurmukhi: "ਗੀਤ", meaning_english: "song", romanised: "geet", starting_letter: "ਗ", distractor_letters: ["ਘ", "ਕ"], display_order: 57 },
  { word_gurmukhi: "ਘੋੜਾ", meaning_english: "horse", romanised: "ghora", starting_letter: "ਘ", distractor_letters: ["ਗ", "ਖ"], display_order: 58 },
  { word_gurmukhi: "ਘੜੀ", meaning_english: "clock", romanised: "ghadi", starting_letter: "ਘ", distractor_letters: ["ਗ", "ਖ"], display_order: 59 },
  { word_gurmukhi: "ਘੱਟ", meaning_english: "less", romanised: "ghatt", starting_letter: "ਘ", distractor_letters: ["ਗ", "ਕ"], display_order: 60 },
  { word_gurmukhi: "ਜੀਭ", meaning_english: "tongue", romanised: "jeebh", starting_letter: "ਜ", distractor_letters: ["ਝ", "ਚ"], display_order: 61 },
  { word_gurmukhi: "ਜੰਗਲ", meaning_english: "forest", romanised: "jangal", starting_letter: "ਜ", distractor_letters: ["ਝ", "ਗ"], display_order: 62 },
  { word_gurmukhi: "ਜਾਮ", meaning_english: "cup", romanised: "jaam", starting_letter: "ਜ", distractor_letters: ["ਝ", "ਚ"], display_order: 63 },
  { word_gurmukhi: "ਝੰਡਾ", meaning_english: "flag", romanised: "jhanda", starting_letter: "ਝ", distractor_letters: ["ਜ", "ਛ"], display_order: 64 },
  { word_gurmukhi: "ਝੂਲਾ", meaning_english: "swing", romanised: "jhoola", starting_letter: "ਝ", distractor_letters: ["ਜ", "ਚ"], display_order: 65 },
  { word_gurmukhi: "ਝੀਲ", meaning_english: "lake", romanised: "jheel", starting_letter: "ਝ", distractor_letters: ["ਜ", "ਛ"], display_order: 66 },
  { word_gurmukhi: "ਝੂਠ", meaning_english: "lie", romanised: "jhooth", starting_letter: "ਝ", distractor_letters: ["ਜ", "ਚ"], display_order: 67 },
  { word_gurmukhi: "ਡੱਬਾ", meaning_english: "box", romanised: "dabba", starting_letter: "ਡ", distractor_letters: ["ਢ", "ਦ"], display_order: 68 },
  { word_gurmukhi: "ਡਾਕ", meaning_english: "post", romanised: "daak", starting_letter: "ਡ", distractor_letters: ["ਢ", "ਦ"], display_order: 69 },
  { word_gurmukhi: "ਡਰ", meaning_english: "fear", romanised: "dar", starting_letter: "ਡ", distractor_letters: ["ਢ", "ਤ"], display_order: 70 },
  { word_gurmukhi: "ਢੋਲ", meaning_english: "drum", romanised: "dhol", starting_letter: "ਢ", distractor_letters: ["ਡ", "ਧ"], display_order: 71 },
  { word_gurmukhi: "ਢੱਕਣ", meaning_english: "lid", romanised: "dhakkan", starting_letter: "ਢ", distractor_letters: ["ਡ", "ਦ"], display_order: 72 },
  { word_gurmukhi: "ਢਾਲ", meaning_english: "shield", romanised: "dhaal", starting_letter: "ਢ", distractor_letters: ["ਡ", "ਧ"], display_order: 73 },
  { word_gurmukhi: "ਢੇਰ", meaning_english: "pile", romanised: "dher", starting_letter: "ਢ", distractor_letters: ["ਡ", "ਦ"], display_order: 74 },
  { word_gurmukhi: "ਦਾਦਾ", meaning_english: "grandfather", romanised: "daada", starting_letter: "ਦ", distractor_letters: ["ਧ", "ਡ"], display_order: 75 },
  { word_gurmukhi: "ਦਿਲ", meaning_english: "heart", romanised: "dil", starting_letter: "ਦ", distractor_letters: ["ਧ", "ਤ"], display_order: 76 },
  { word_gurmukhi: "ਧਰਤੀ", meaning_english: "earth", romanised: "dharti", starting_letter: "ਧ", distractor_letters: ["ਦ", "ਢ"], display_order: 77 },
  { word_gurmukhi: "ਧਾਗਾ", meaning_english: "thread", romanised: "dhaaga", starting_letter: "ਧ", distractor_letters: ["ਦ", "ਥ"], display_order: 78 },
  { word_gurmukhi: "ਧਨ", meaning_english: "wealth", romanised: "dhan", starting_letter: "ਧ", distractor_letters: ["ਦ", "ਡ"], display_order: 79 },
  { word_gurmukhi: "ਬਿੱਲੀ", meaning_english: "cat", romanised: "billi", starting_letter: "ਬ", distractor_letters: ["ਭ", "ਪ"], display_order: 80 },
  { word_gurmukhi: "ਬੱਚਾ", meaning_english: "child", romanised: "bacha", starting_letter: "ਬ", distractor_letters: ["ਭ", "ਪ"], display_order: 81 },
  { word_gurmukhi: "ਭੈਣ", meaning_english: "sister", romanised: "bhain", starting_letter: "ਭ", distractor_letters: ["ਬ", "ਪ"], display_order: 82 },
  { word_gurmukhi: "ਭਰਾ", meaning_english: "brother", romanised: "bhraa", starting_letter: "ਭ", distractor_letters: ["ਬ", "ਫ"], display_order: 83 },
  { word_gurmukhi: "ਭੁੱਖ", meaning_english: "hunger", romanised: "bhukkh", starting_letter: "ਭ", distractor_letters: ["ਬ", "ਪ"], display_order: 84 },
  { word_gurmukhi: "ਭਗਤ", meaning_english: "devotee", romanised: "bhagat", starting_letter: "ਭ", distractor_letters: ["ਬ", "ਘ"], display_order: 85 },
  { word_gurmukhi: "ਨਦੀ", meaning_english: "river", romanised: "nadi", starting_letter: "ਨ", distractor_letters: ["ਣ", "ਮ"], display_order: 86 },
  { word_gurmukhi: "ਨੀਂਦ", meaning_english: "sleep", romanised: "neend", starting_letter: "ਨ", distractor_letters: ["ਣ", "ਮ"], display_order: 87 },
  { word_gurmukhi: "ਮੱਛੀ", meaning_english: "fish", romanised: "macchi", starting_letter: "ਮ", distractor_letters: ["ਨ", "ਬ"], display_order: 88 },
];

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");

  const supabase = createClient(url, key);
  const { error } = await supabase.from("word_start_game_words").upsert(NEW_WORDS, {
    onConflict: "word_gurmukhi",
    ignoreDuplicates: false,
  });
  if (error) throw new Error(error.message);

  const { data, error: countError } = await supabase
    .from("word_start_game_words")
    .select("word_gurmukhi, starting_letter, audio_pa_url");
  if (countError) throw new Error(countError.message);

  const missingAudio = (data ?? []).filter((row) => !row.audio_pa_url).length;
  const byLetter = new Map<string, number>();
  for (const row of data ?? []) {
    byLetter.set(row.starting_letter, (byLetter.get(row.starting_letter) ?? 0) + 1);
  }
  console.log(`upserted ${NEW_WORDS.length} extra words`);
  console.log(`total rows=${data?.length ?? 0} missing_audio=${missingAudio}`);
  console.log(
    [...byLetter.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "pa"))
      .map(([letter, count]) => `${letter}:${count}`)
      .join(" ")
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
