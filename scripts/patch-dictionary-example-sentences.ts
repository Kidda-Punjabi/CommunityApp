/**
 * Add example sentences to original conversational dictionary cards that lack them.
 *
 * Usage:
 *   npx tsx scripts/patch-dictionary-example-sentences.ts
 *   npx tsx scripts/patch-dictionary-example-sentences.ts --dry-run
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type ExamplePatch = {
  gurmukhi: string;
  romanised: string;
  english: string;
};

/** Keyed by flashcard id — safe for duplicate front_text labels like "How are you?" */
const EXAMPLE_PATCHES: Record<string, ExamplePatch> = {
  "49fc0fab-d10b-4494-adec-64474379273b": {
    gurmukhi: "ਹਾਂ ਜੀ, ਮੈਂ ਪੰਜਾਬੀ ਬੋਲਦਾ ਹਾਂ। ਕੀ ਤੁਸੀਂ ਵੀ ਪੰਜਾਬੀ ਬੋਲਦੇ ਹੋ?",
    romanised: "Haan ji, main Panjabi bolada haan. Ki tusi vi Panjabi bolde ho?",
    english: "Yes, I speak Punjabi. Do you speak Punjabi too?",
  },
  "1281c06c-6780-4164-bfcc-d708438b9352": {
    gurmukhi: "ਅੱਜ ਤੁਹਾਡਾ ਦਿਨ ਬਹੁਤ ਚੰਗਾ ਹੋਵੇ।",
    romanised: "Ajj tuhadda din bahut changa hove.",
    english: "May you have a very good day today.",
  },
  "9a09639c-9160-4bd0-bfcf-16a105979898": {
    gurmukhi: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮਿਲ ਕੇ ਬਹੁਤ ਚੰਗਾ ਲੱਗਿਆ।",
    romanised: "Sat Sri Akal! Mil ke bahut changa laggia.",
    english: "Sat Sri Akal! It was lovely to meet you.",
  },
  "5e0c9938-e477-43e2-bcb3-882772e25e1d": {
    gurmukhi: "ਕੀ ਹਾਲ ਹੈ? ਮੈਂ ਠੀਕ ਹਾਂ, ਤੁਸੀਂ ਦੱਸੋ।",
    romanised: "Ki haal hai? Main theek haan, tusi daso.",
    english: "How are you? I'm fine — you tell me.",
  },
  "fcda85ee-4ff8-4b8c-92bb-bb29450436ab": {
    gurmukhi: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ, ਤੁਸੀਂ ਠੀਕ ਹੋ?",
    romanised: "Sat Sri Akal, tusi theek ho?",
    english: "Hello, are you well?",
  },
  "3342b601-c9db-420d-a5e7-96cea40e7a30": {
    gurmukhi: "ਤੁਸੀਂ ਕਿੰਨੇ ਸਾਲ ਦੇ ਹੋ? ਮੈਂ ਵੀਹ ਸਾਲ ਦਾ ਹਾਂ।",
    romanised: "Tusi kinne saal de ho? Main veh saal da haan.",
    english: "How old are you? I am twenty years old.",
  },
  "cd67b7ef-bea6-4e6c-ad12-5c6e38ee34ba": {
    gurmukhi: "ਮਾਫ਼ ਕਰਨਾ, ਮੈਨੂੰ ਸਮਝ ਨਹੀਂ ਆਈ। ਕੀ ਤੁਸੀਂ ਫੇਰ ਦੱਸ ਸਕਦੇ ਹੋ?",
    romanised: "Maaf karna, mainu samajh nahi aai. Ki tusi phir das sakde ho?",
    english: "Sorry, I didn't understand. Can you say it again?",
  },
  "4cd8f3d8-1dcf-4d5f-b14d-f34dc56d25f2": {
    gurmukhi: "ਮੈਨੂੰ ਇਸਦਾ ਜਵਾਬ ਨਹੀਂ ਪਤਾ।",
    romanised: "Mainu isda jawab nahi pata.",
    english: "I don't know the answer to this.",
  },
  "be6fe484-9722-454d-8c23-d058f29e5ed3": {
    gurmukhi: "ਮੈਂ ਆਪਣੀ ਦੁਕਾਨ ਚਲਾਂਦਾ ਹਾਂ।",
    romanised: "Main apni dukaan chalanda haan.",
    english: "I run my own shop.",
  },
  "ad0ecc4d-e190-4df3-9202-4cbe9a6f3ab8": {
    gurmukhi: "ਮੈਂ ਹਸਪਤਾਲ ਵਿੱਚ ਨੌਕਰੀ ਕਰਦੀ ਹਾਂ।",
    romanised: "Main hospital vich naukari kardi haan.",
    english: "I work a job at the hospital.",
  },
  "452284bb-6400-4fd9-916d-7ff37d0cda38": {
    gurmukhi: "ਮੈਂ ਅੱਜ ਥੋੜ੍ਹੀ ਬਿਮਾਰ ਹਾਂ।",
    romanised: "Main ajj thori bimaar haan.",
    english: "I'm a little ill today.",
  },
  "fb313a11-2062-4e36-8917-5287c0b6e073": {
    gurmukhi: "ਮੈਂ ਕਾਲਜ ਵਿੱਚ ਪੜ਼ਦਾ ਹਾਂ ਅਤੇ ਸਟੂਡੈਂਟ ਹਾਂ।",
    romanised: "Main college vich parhda haan ate student haan.",
    english: "I study at college and I am a student.",
  },
  "2b53015f-893f-4b31-83ef-7f504ab298ad": {
    gurmukhi: "ਧੰਨਵਾਦ, ਮੈਂ ਠੀਕ ਹਾਂ।",
    romanised: "Dhannvaad, main theek haan.",
    english: "Thank you, I'm fine.",
  },
  "9ecbef06-41d5-41ec-9f62-f1952ade1c1e": {
    gurmukhi: "ਮੈਂ ਇੱਕ ਚੰਗੀ ਨੌਕਰੀ ਲੱਭ ਰਿਹਾ ਹਾਂ।",
    romanised: "Main ik changi naukari labh riha haan.",
    english: "I'm looking for a good job.",
  },
  "84412ac7-b33a-4cae-aaf5-9673fb7e4060": {
    gurmukhi: "ਚਲੋ, ਅਸੀਂ ਹੁਣ ਚਲਦੇ ਹਾਂ।",
    romanised: "Chalo, asi hun chalde haan.",
    english: "Let's go — we are leaving now.",
  },
  "620424e8-60b5-4498-a8b4-d30dab5cb1de": {
    gurmukhi: "ਮੇਰਾ ਨਾਮ ਸਿਮਰਨ ਹੈ।",
    romanised: "Mera naam Simran hai.",
    english: "My name is Simran.",
  },
  "3e668430-4740-41de-8356-881605ae11cf": {
    gurmukhi: "ਤੁਹਾਨੂੰ ਮਿਲ ਕੇ ਬਹੁਤ ਚੰਗਾ ਲੱਗਿਆ।",
    romanised: "Tuhanu mil ke bahut changa laggia.",
    english: "It was lovely to meet you.",
  },
  "7badff81-713f-49e0-941d-8d8c61e16bf8": {
    gurmukhi: "ਕੋਈ ਗੱਲ ਨਹੀਂ, ਇਹ ਸਧਾਰਨ ਗੱਲ ਹੈ।",
    romanised: "Koi gall nahi, eh sadhaaran gall hai.",
    english: "No problem — it's a normal thing.",
  },
  "57fdfa0d-759c-476c-a860-d8058ea5300e": {
    gurmukhi: "ਨਹੀਂ ਜੀ, ਪਰ ਮੈਨੂੰ ਪੰਜਾਬੀ ਸਮਝ ਆਉਂਦੀ ਹੈ।",
    romanised: "Nahi ji, par mainu Panjabi samajh aundi hai.",
    english: "No, but I understand Punjabi.",
  },
  "fb3b9a30-f407-490a-bef7-5baa8d012e08": {
    gurmukhi: "ਚਲੋ ਫਿਰ, ਫਿਰ ਮਿਲਦੇ ਹਾਂ।",
    romanised: "Chalo phir, phir milde haan.",
    english: "Alright then, see you again.",
  },
  "2ba9661a-8336-4f8d-bcc1-b86f4fc35296": {
    gurmukhi: "ਇਹ ਬਹੁਤ ਦਿਲਚਸਪ ਹੈ — ਹੋਰ ਸੁਣਾਓ।",
    romanised: "Eh bahut dilchasp hai — hor sunao.",
    english: "That's very interesting — tell me more.",
  },
  "187f1c83-3c77-474a-83d1-8cad672890d9": {
    gurmukhi: "ਤੁਹਾਡਾ ਬਹੁਤ ਧੰਨਵਾਦ।",
    romanised: "Tuhadda bahut dhannvaad.",
    english: "Thank you very much.",
  },
  "05b2bb58-6532-447b-8cd6-b8b2588890bc": {
    gurmukhi: "ਮੇਰੀ ਗੱਲ ਸੁਣਨ ਲਈ ਧੰਨਵਾਦ।",
    romanised: "Meri gall sunan lai dhannvaad.",
    english: "Thank you for listening to me.",
  },
  "e53d69d0-939e-445d-8268-cf888fcb1c73": {
    gurmukhi: "ਬਸ, ਇਹ ਮੇਰੇ ਬਾਰੇ ਸਾਰੀ ਗੱਲ ਸੀ।",
    romanised: "Bas, eh mere baare saari gall si.",
    english: "That's all about me.",
  },
  "9647c10f-476d-4552-8dd9-961761dad004": {
    gurmukhi: "ਬਹੁਤ ਵਧੀਆ! ਤੁਸੀਂ ਬਹੁਤ ਚੰਗਾ ਕੀਤਾ।",
    romanised: "Bahut vadhiya! Tusi bahut changa kita.",
    english: "Very good! You did very well.",
  },
  "49e55d4f-60e7-4735-bfbb-a6c071e8612d": {
    gurmukhi: "ਤੁਸੀਂ ਕੀ ਕਰਦੇ ਹੋ? ਮੈਂ ਅਧਿਆਪਕ ਹਾਂ।",
    romanised: "Tusi ki karde ho? Main adhyapak haan.",
    english: "What do you do? I am a teacher.",
  },
  "a781ec1a-f782-474b-8b2a-12a26a8292bc": {
    gurmukhi: "ਤੁਹਾਡਾ ਨਾਮ ਕੀ ਹੈ? ਮੇਰਾ ਨਾਮ ਰਾਜ ਹੈ।",
    romanised: "Tuhada naam ki hai? Mera naam Raj hai.",
    english: "What's your name? My name is Raj.",
  },
  "9601f711-5483-44a0-930b-3513479f670e": {
    gurmukhi: "ਤੁਸੀਂ ਕਿੱਥੋਂ ਹੋ? ਮੈਂ ਲੰਡਨ ਤੋਂ ਹਾਂ।",
    romanised: "Tusi kitthon ho? Main London ton haan.",
    english: "Where are you from? I am from London.",
  },
  "25f35c84-6621-4e4c-81a9-90795b3f2cce": {
    gurmukhi: "ਹਾਂ ਜੀ, ਮੈਂ ਪੰਜਾਬੀ ਸਿੱਖ ਰਿਹਾ ਹਾਂ।",
    romanised: "Hanji, main Panjabi sikh riha haan.",
    english: "Yes, I'm learning Punjabi.",
  },
  "d57c5c38-f516-4df4-b05a-a31cc538f63a": {
    gurmukhi: "ਹਾਂ ਜੀ, ਮੈਂ ਥੋੜ੍ਹੀ ਬਹੁਤ ਪੰਜਾਬੀ ਬੋਲਦਾ ਹਾਂ।",
    romanised: "Hanji, main thori bahut Panjabi bolada haan.",
    english: "Yes, I speak a little Punjabi.",
  },
};

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split("\n")) {
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
  const dryRun = process.argv.includes("--dry-run");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ids = Object.keys(EXAMPLE_PATCHES);
  const { data: cards, error } = await supabase
    .from("flashcards")
    .select("id, front_text, example_sentence_gurmukhi")
    .in("id", ids);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const found = new Set((cards ?? []).map((card) => card.id as string));
  const missingIds = ids.filter((id) => !found.has(id));
  if (missingIds.length > 0) {
    console.error("Flashcard ids not found:", missingIds.join(", "));
    process.exit(1);
  }

  let updated = 0;
  let skipped = 0;

  for (const card of cards ?? []) {
    const id = card.id as string;
    const patch = EXAMPLE_PATCHES[id];
    if (card.example_sentence_gurmukhi?.trim()) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] ${card.front_text}`);
      updated++;
      continue;
    }

    const { error: updateError } = await supabase
      .from("flashcards")
      .update({
        example_sentence_gurmukhi: patch.gurmukhi,
        example_sentence_romanised: patch.romanised,
        example_sentence_english: patch.english,
      })
      .eq("id", id);

    if (updateError) {
      console.error(`Failed ${card.front_text}:`, updateError.message);
      process.exit(1);
    }

    console.log(`Updated example — ${card.front_text}`);
    updated++;
  }

  console.log(`\nDone: ${updated} patched, ${skipped} already had example text.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
