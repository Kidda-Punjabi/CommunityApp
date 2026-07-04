/**
 * Seed Comprehension Practice scripts (Batch 4 — Short tier, final 6).
 *
 * This is a Node script — do NOT paste into Supabase SQL Editor.
 * For SQL Editor use: supabase/comprehension-short-tier-seed-batch-4.sql
 *
 * Usage:
 *   npx tsx scripts/seed-comprehension-batch-4.ts
 *   npx tsx scripts/seed-comprehension-batch-4.ts --dry-run
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

type SentenceRow = {
  gurmukhi: string;
  romanised: string;
  english: string;
};

type QuestionRow = {
  gurmukhi: string;
  romanised: string;
  options: [string, string, string, string];
  correct: "a" | "b" | "c" | "d";
};

type ScriptSeed = {
  title: string;
  description: string;
  difficulty: number;
  displayOrder: number;
  sentences: SentenceRow[];
  questions: QuestionRow[];
};

const BATCH_ID = "comprehension-batch-4-short";

const SCRIPTS: ScriptSeed[] = [
  {
    title: "Your weekly schedule",
    description:
      "Draft — pending native speaker review. Present habitual weekly schedule. Access: free.",
    difficulty: 3,
    displayOrder: 10,
    sentences: [
      {
        gurmukhi: "ਸੋਮਵਾਰ ਨੂੰ ਮੈਂ ਕੰਮ 'ਤੇ ਜਾਂਦਾ ਹਾਂ।",
        romanised: "Somvaar nu mai kaam te jaanda haa.",
        english: "On Monday I go to work.",
      },
      {
        gurmukhi: "ਬੁੱਧਵਾਰ ਨੂੰ ਮੈਂ ਪੰਜਾਬੀ ਸਿੱਖਦਾ ਹਾਂ।",
        romanised: "Budhvaar nu mai Punjabi sikhda haa.",
        english: "On Wednesday I learn Punjabi.",
      },
      {
        gurmukhi: "ਸ਼ੁੱਕਰਵਾਰ ਨੂੰ ਮੈਂ ਦੋਸਤਾਂ ਨਾਲ ਮਿਲਦਾ ਹਾਂ।",
        romanised: "Shukarvaar nu mai dostaa naal milda haa.",
        english: "On Friday I meet with friends.",
      },
      {
        gurmukhi: "ਸ਼ਨੀਵਾਰ ਨੂੰ ਮੈਂ ਆਰਾਮ ਕਰਦਾ ਹਾਂ।",
        romanised: "Shanivaar nu mai aaraam karda haa.",
        english: "On Saturday I rest.",
      },
      {
        gurmukhi: "ਐਤਵਾਰ ਨੂੰ ਅਸੀਂ ਪਰਿਵਾਰ ਨਾਲ ਸਮਾਂ ਬਿਤਾਉਂਦੇ ਹਾਂ।",
        romanised: "Aitvaar nu asi parivar naal samaa bitaunde haa.",
        english: "On Sunday we spend time with family.",
      },
    ],
    questions: [
      {
        gurmukhi: "ਮੈਂ ਬੁੱਧਵਾਰ ਨੂੰ ਕੀ ਕਰਦਾ ਹਾਂ?",
        romanised: "Mai budhvaar nu ki karda haa?",
        options: [
          "ਕੰਮ (kaam)",
          "ਪੰਜਾਬੀ ਸਿੱਖਦਾ ਹਾਂ (Punjabi sikhda haa)",
          "ਆਰਾਮ (aaraam)",
          "ਦੋਸਤਾਂ ਨਾਲ ਮਿਲਦਾ ਹਾਂ (dostaa naal milda haa)",
        ],
        correct: "b",
      },
      {
        gurmukhi: "ਮੈਂ ਦੋਸਤਾਂ ਨਾਲ ਕਦੋਂ ਮਿਲਦਾ ਹਾਂ?",
        romanised: "Mai dostaa naal kadon milda haa?",
        options: ["ਸੋਮਵਾਰ (Somvaar)", "ਸ਼ੁੱਕਰਵਾਰ (Shukarvaar)", "ਐਤਵਾਰ (Aitvaar)", "ਬੁੱਧਵਾਰ (Budhvaar)"],
        correct: "b",
      },
      {
        gurmukhi: "ਐਤਵਾਰ ਨੂੰ ਅਸੀਂ ਕੀ ਕਰਦੇ ਹਾਂ?",
        romanised: "Aitvaar nu asi ki karde haa?",
        options: [
          "ਕੰਮ ਕਰਦੇ ਹਾਂ (kaam karde haa)",
          "ਪਰਿਵਾਰ ਨਾਲ ਸਮਾਂ ਬਿਤਾਉਂਦੇ ਹਾਂ (parivar naal samaa bitaunde haa)",
          "ਸੌਂਦੇ ਹਾਂ (saunde haa)",
          "ਖੇਡਦੇ ਹਾਂ (khedde haa)",
        ],
        correct: "b",
      },
    ],
  },
  {
    title: "A phone call to say hello",
    description:
      "Draft — pending native speaker review. Past-tense phone call to grandmother. Access: free.",
    difficulty: 3,
    displayOrder: 11,
    sentences: [
      {
        gurmukhi: "ਕੱਲ੍ਹ ਮੈਂ ਆਪਣੀ ਨਾਨੀ ਨੂੰ ਫ਼ੋਨ ਕੀਤਾ ਸੀ।",
        romanised: "Kallh mai apni naani nu phone kita si.",
        english: "Yesterday I had called my grandmother.",
      },
      {
        gurmukhi: "ਉਹ ਬਹੁਤ ਖੁਸ਼ ਹੋਈ ਸੀ।",
        romanised: "Oh bahut khush hoi si.",
        english: "She had become very happy.",
      },
      {
        gurmukhi: "ਅਸੀਂ ਅੱਧਾ ਘੰਟਾ ਗੱਲ ਕੀਤੀ ਸੀ।",
        romanised: "Asi adhaa ghanta gall kiti si.",
        english: "We had talked for half an hour.",
      },
      {
        gurmukhi: "ਉਸਨੇ ਮੈਨੂੰ ਆਪਣੀ ਸਿਹਤ ਬਾਰੇ ਦੱਸਿਆ ਸੀ।",
        romanised: "Usne mainu apni sehat baare dassiya si.",
        english: "She had told me about her health.",
      },
      {
        gurmukhi: "ਮੈਂ ਜਲਦੀ ਮਿਲਣ ਦਾ ਵਾਅਦਾ ਕੀਤਾ ਸੀ।",
        romanised: "Mai jaldi milan da vaada kita si.",
        english: "I had promised to meet soon.",
      },
    ],
    questions: [
      {
        gurmukhi: "ਮੈਂ ਕਿਸਨੂੰ ਫ਼ੋਨ ਕੀਤਾ?",
        romanised: "Mai kisnu phone kita?",
        options: ["ਨਾਨੀ (Naani)", "ਦਾਦੀ (Daadi)", "ਮਾਸੀ (Maasi)", "ਭੂਆ (Bhua)"],
        correct: "a",
      },
      {
        gurmukhi: "ਅਸੀਂ ਕਿੰਨੀ ਦੇਰ ਗੱਲ ਕੀਤੀ?",
        romanised: "Asi kinni der gall kiti?",
        options: [
          "ਪੰਦਰਾਂ ਮਿੰਟ (pandraa minute)",
          "ਅੱਧਾ ਘੰਟਾ (adhaa ghanta)",
          "ਇੱਕ ਘੰਟਾ (ik ghanta)",
          "ਦੋ ਘੰਟੇ (do ghante)",
        ],
        correct: "b",
      },
      {
        gurmukhi: "ਮੈਂ ਕੀ ਵਾਅਦਾ ਕੀਤਾ?",
        romanised: "Mai ki vaada kita?",
        options: [
          "ਪੈਸੇ ਭੇਜਣ ਦਾ (paise bhejan da)",
          "ਜਲਦੀ ਮਿਲਣ ਦਾ (jaldi milan da)",
          "ਚਿੱਠੀ ਲਿਖਣ ਦਾ (chitthi likhan da)",
          "ਫ਼ੋਨ ਕਰਨ ਦਾ (phone karan da)",
        ],
        correct: "b",
      },
    ],
  },
  {
    title: "Shopping for clothes",
    description:
      "Draft — pending native speaker review. Past-tense clothes shopping. Access: free.",
    difficulty: 3,
    displayOrder: 12,
    sentences: [
      {
        gurmukhi: "ਅਸੀਂ ਕੱਪੜਿਆਂ ਦੀ ਦੁਕਾਨ 'ਤੇ ਗਏ ਸੀ।",
        romanised: "Asi kapriaa di dukaan te gae si.",
        english: "We had gone to a clothes shop.",
      },
      {
        gurmukhi: "ਮੈਂ ਇੱਕ ਨਵੀਂ ਕਮੀਜ਼ ਖਰੀਦੀ ਸੀ।",
        romanised: "Mai ik navee kameez kharidi si.",
        english: "I had bought a new shirt.",
      },
      {
        gurmukhi: "ਮੇਰੀ ਭੈਣ ਨੇ ਇੱਕ ਸੂਟ ਪਸੰਦ ਕੀਤਾ ਸੀ।",
        romanised: "Meri bhain ne ik suit pasand kita si.",
        english: "My sister had liked a suit.",
      },
      {
        gurmukhi: "ਦੁਕਾਨਦਾਰ ਨੇ ਸਾਨੂੰ ਛੋਟ ਦਿੱਤੀ ਸੀ।",
        romanised: "Dukaandaar ne saanu chhot ditti si.",
        english: "The shopkeeper had given us a discount.",
      },
      {
        gurmukhi: "ਅਸੀਂ ਬਹੁਤ ਖੁਸ਼ ਹੋ ਕੇ ਘਰ ਆਏ ਸੀ।",
        romanised: "Asi bahut khush ho ke ghar aae si.",
        english: "We had come home very happy.",
      },
    ],
    questions: [
      {
        gurmukhi: "ਮੈਂ ਕੀ ਖਰੀਦਿਆ?",
        romanised: "Mai ki kharidiya?",
        options: ["ਕਮੀਜ਼ (kameez)", "ਸੂਟ (suit)", "ਜੁੱਤੇ (jutte)", "ਦੁਪੱਟਾ (dupatta)"],
        correct: "a",
      },
      {
        gurmukhi: "ਭੈਣ ਨੇ ਕੀ ਪਸੰਦ ਕੀਤਾ?",
        romanised: "Bhain ne ki pasand kita?",
        options: ["ਕਮੀਜ਼ (kameez)", "ਸੂਟ (suit)", "ਦੁਪੱਟਾ (dupatta)", "ਜੁੱਤੇ (jutte)"],
        correct: "b",
      },
      {
        gurmukhi: "ਦੁਕਾਨਦਾਰ ਨੇ ਕੀ ਦਿੱਤਾ?",
        romanised: "Dukaandaar ne ki ditta?",
        options: ["ਤੋਹਫ਼ਾ (tohfa)", "ਛੋਟ (chhot)", "ਬਿੱਲ (bill)", "ਰਸੀਦ (raseed)"],
        correct: "b",
      },
    ],
  },
  {
    title: "A trip to the gurdwara",
    description:
      "Draft — pending native speaker review. Past-tense Sunday gurdwara visit. Access: free.",
    difficulty: 3,
    displayOrder: 13,
    sentences: [
      {
        gurmukhi: "ਐਤਵਾਰ ਨੂੰ ਅਸੀਂ ਗੁਰਦੁਆਰੇ ਗਏ ਸੀ।",
        romanised: "Aitvaar nu asi gurduare gae si.",
        english: "On Sunday we had gone to the gurdwara.",
      },
      {
        gurmukhi: "ਅਸੀਂ ਅਰਦਾਸ ਵਿੱਚ ਬੈਠੇ ਸੀ।",
        romanised: "Asi ardaas vich baithe si.",
        english: "We had sat for the ardaas (prayer).",
      },
      {
        gurmukhi: "ਬਾਅਦ ਵਿੱਚ ਅਸੀਂ ਲੰਗਰ ਛਕਿਆ ਸੀ।",
        romanised: "Baad vich asi langar chakiya si.",
        english: "Afterwards we had eaten langar.",
      },
      {
        gurmukhi: "ਲੰਗਰ ਬਹੁਤ ਸੁਆਦੀ ਸੀ।",
        romanised: "Langar bahut suadi si.",
        english: "The langar was very tasty.",
      },
      {
        gurmukhi: "ਅਸੀਂ ਮਨ ਵਿੱਚ ਸ਼ਾਂਤੀ ਮਹਿਸੂਸ ਕੀਤੀ ਸੀ।",
        romanised: "Asi man vich shaanti mehsoos kiti si.",
        english: "We had felt peace in our hearts.",
      },
    ],
    questions: [
      {
        gurmukhi: "ਅਸੀਂ ਕਦੋਂ ਗੁਰਦੁਆਰੇ ਗਏ?",
        romanised: "Asi kadon gurduare gae?",
        options: ["ਸ਼ਨੀਵਾਰ (Shanivaar)", "ਐਤਵਾਰ (Aitvaar)", "ਸੋਮਵਾਰ (Somvaar)", "ਸ਼ੁੱਕਰਵਾਰ (Shukarvaar)"],
        correct: "b",
      },
      {
        gurmukhi: "ਬਾਅਦ ਵਿੱਚ ਅਸੀਂ ਕੀ ਕੀਤਾ?",
        romanised: "Baad vich asi ki kita?",
        options: [
          "ਲੰਗਰ ਛਕਿਆ (langar chakiya)",
          "ਘਰ ਗਏ (ghar gae)",
          "ਸ਼ਾਪਿੰਗ ਕੀਤੀ (shopping kiti)",
          "ਅਰਦਾਸ ਕੀਤੀ (ardaas kiti)",
        ],
        correct: "a",
      },
      {
        gurmukhi: "ਲੰਗਰ ਕਿਹੋ ਜਿਹਾ ਸੀ?",
        romanised: "Langar kiho jiha si?",
        options: ["ਸੁਆਦੀ (suadi)", "ਠੰਡਾ (thanda)", "ਖਰਾਬ (kharab)", "ਗਰਮ (garam)"],
        correct: "a",
      },
    ],
  },
  {
    title: "Playing a sport with friends",
    description:
      "Draft — pending native speaker review. Past-tense cricket in the park. Access: free.",
    difficulty: 3,
    displayOrder: 14,
    sentences: [
      {
        gurmukhi: "ਸ਼ਾਮ ਨੂੰ ਅਸੀਂ ਪਾਰਕ ਵਿੱਚ ਕ੍ਰਿਕਟ ਖੇਡਿਆ ਸੀ।",
        romanised: "Shaam nu asi park vich cricket khediya si.",
        english: "In the evening we had played cricket in the park.",
      },
      {
        gurmukhi: "ਮੇਰੇ ਦੋਸਤ ਨੇ ਬਹੁਤ ਵਧੀਆ ਬੱਲੇਬਾਜ਼ੀ ਕੀਤੀ ਸੀ।",
        romanised: "Mere dost ne bahut vadhia ballebaazi kiti si.",
        english: "My friend had batted very well.",
      },
      {
        gurmukhi: "ਸਾਡੀ ਟੀਮ ਜਿੱਤ ਗਈ ਸੀ।",
        romanised: "Saadi team jitt gai si.",
        english: "Our team had won.",
      },
      {
        gurmukhi: "ਖੇਡ ਤੋਂ ਬਾਅਦ ਅਸੀਂ ਜੂਸ ਪੀਤਾ ਸੀ।",
        romanised: "Khed toh baad asi juice peeta si.",
        english: "After the game we had drunk juice.",
      },
      {
        gurmukhi: "ਸਾਰਿਆਂ ਨੇ ਬਹੁਤ ਮਜ਼ਾ ਕੀਤਾ ਸੀ।",
        romanised: "Saariaa ne bahut maza kita si.",
        english: "Everyone had had a lot of fun.",
      },
    ],
    questions: [
      {
        gurmukhi: "ਅਸੀਂ ਕਿਹੜੀ ਖੇਡ ਖੇਡੀ?",
        romanised: "Asi kihri khed khedi?",
        options: ["ਫੁੱਟਬਾਲ (football)", "ਕ੍ਰਿਕਟ (cricket)", "ਹਾਕੀ (hockey)", "ਵਾਲੀਬਾਲ (volleyball)"],
        correct: "b",
      },
      {
        gurmukhi: "ਕੌਣ ਜਿੱਤਿਆ?",
        romanised: "Kaun jittiya?",
        options: [
          "ਦੂਸਰੀ ਟੀਮ (doosri team)",
          "ਸਾਡੀ ਟੀਮ (saadi team)",
          "ਕੋਈ ਨਹੀਂ (koi nahi)",
          "ਦੋਵਾਂ ਟੀਮਾਂ (dovaan teamaa)",
        ],
        correct: "b",
      },
      {
        gurmukhi: "ਖੇਡ ਤੋਂ ਬਾਅਦ ਅਸੀਂ ਕੀ ਪੀਤਾ?",
        romanised: "Khed toh baad asi ki peeta?",
        options: ["ਚਾਹ (chah)", "ਜੂਸ (juice)", "ਪਾਣੀ (pani)", "ਲੱਸੀ (lassi)"],
        correct: "b",
      },
    ],
  },
  {
    title: "A simple recipe you know",
    description:
      "Draft — pending native speaker review. Present habitual tea-making instructions. Access: free.",
    difficulty: 2,
    displayOrder: 15,
    sentences: [
      {
        gurmukhi: "ਮੈਨੂੰ ਚਾਹ ਬਣਾਉਣੀ ਆਉਂਦੀ ਹੈ।",
        romanised: "Mainu chah banaunee aaundi hai.",
        english: "I know how to make tea.",
      },
      {
        gurmukhi: "ਪਹਿਲਾਂ ਮੈਂ ਪਾਣੀ ਉਬਾਲਦਾ ਹਾਂ।",
        romanised: "Pehlaa mai pani ubaalda haa.",
        english: "First I boil water.",
      },
      {
        gurmukhi: "ਫਿਰ ਮੈਂ ਚਾਹ ਪੱਤੀ ਅਤੇ ਦੁੱਧ ਪਾਉਂਦਾ ਹਾਂ।",
        romanised: "Phir mai chah patti ate dudh paunda haa.",
        english: "Then I add tea leaves and milk.",
      },
      {
        gurmukhi: "ਅਖੀਰ ਵਿੱਚ ਮੈਂ ਖੰਡ ਪਾਉਂਦਾ ਹਾਂ।",
        romanised: "Akheer vich mai khand paunda haa.",
        english: "At the end I add sugar.",
      },
      {
        gurmukhi: "ਗਰਮ ਚਾਹ ਪੀਣ ਦਾ ਮਜ਼ਾ ਹੀ ਵੱਖਰਾ ਹੈ।",
        romanised: "Garam chah peen da maza hi vakhra hai.",
        english: "Drinking hot tea is a joy like no other.",
      },
    ],
    questions: [
      {
        gurmukhi: "ਮੈਂ ਪਹਿਲਾਂ ਕੀ ਕਰਦਾ ਹਾਂ?",
        romanised: "Mai pehlaa ki karda haa?",
        options: [
          "ਚਾਹ ਪੱਤੀ ਪਾਉਂਦਾ ਹਾਂ (chah patti paunda haa)",
          "ਪਾਣੀ ਉਬਾਲਦਾ ਹਾਂ (pani ubaalda haa)",
          "ਖੰਡ ਪਾਉਂਦਾ ਹਾਂ (khand paunda haa)",
          "ਦੁੱਧ ਪਾਉਂਦਾ ਹਾਂ (dudh paunda haa)",
        ],
        correct: "b",
      },
      {
        gurmukhi: "ਅਖੀਰ ਵਿੱਚ ਮੈਂ ਕੀ ਪਾਉਂਦਾ ਹਾਂ?",
        romanised: "Akheer vich mai ki paunda haa?",
        options: ["ਦੁੱਧ (dudh)", "ਖੰਡ (khand)", "ਪਾਣੀ (pani)", "ਚਾਹ ਪੱਤੀ (chah patti)"],
        correct: "b",
      },
      {
        gurmukhi: "ਮੈਂ ਕੀ ਬਣਾਉਣਾ ਜਾਣਦਾ ਹਾਂ?",
        romanised: "Mai ki banaunaa jaanda haa?",
        options: ["ਕੌਫੀ (coffee)", "ਚਾਹ (chah)", "ਦੁੱਧ (dudh)", "ਜੂਸ (juice)"],
        correct: "b",
      },
    ],
  },
];

function questionText(row: QuestionRow): string {
  return `${row.gurmukhi} (${row.romanised})`;
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  console.log(`Seeding ${SCRIPTS.length} comprehension scripts (${BATCH_ID})${dryRun ? " [dry run]" : ""}…`);

  for (const script of SCRIPTS) {
    console.log(`\n→ ${script.title}`);

    if (dryRun) {
      console.log(`  ${script.sentences.length} sentences, ${script.questions.length} questions`);
      continue;
    }

    const { data: existing } = await supabase
      .from("comprehension_scripts")
      .select("id")
      .eq("title", script.title)
      .maybeSingle();

    if (existing?.id) {
      const { error: deleteError } = await supabase
        .from("comprehension_scripts")
        .delete()
        .eq("id", existing.id);
      if (deleteError) {
        console.error(`  Failed to replace existing script: ${deleteError.message}`);
        process.exit(1);
      }
      console.log("  Replaced existing script with same title");
    }

    const { data: scriptRow, error: scriptError } = await supabase
      .from("comprehension_scripts")
      .insert({
        title: script.title,
        description: script.description,
        tier: "short",
        difficulty: script.difficulty,
        display_order: script.displayOrder,
        active: true,
        needs_rewrite: false,
      })
      .select("id")
      .single();

    if (scriptError || !scriptRow) {
      console.error(`  Script insert failed: ${scriptError?.message ?? "unknown"}`);
      process.exit(1);
    }

    const scriptId = scriptRow.id as string;

    const { data: paragraphRow, error: paragraphError } = await supabase
      .from("comprehension_paragraphs")
      .insert({ script_id: scriptId, sequence_order: 1 })
      .select("id")
      .single();

    if (paragraphError || !paragraphRow) {
      console.error(`  Paragraph insert failed: ${paragraphError?.message ?? "unknown"}`);
      process.exit(1);
    }

    const paragraphId = paragraphRow.id as string;

    const sentenceRows = script.sentences.map((sentence, index) => ({
      script_id: scriptId,
      paragraph_id: paragraphId,
      sequence_order: index + 1,
      gurmukhi_text: sentence.gurmukhi,
      romanised_text: sentence.romanised,
      english_translation: sentence.english,
    }));

    const { error: sentencesError } = await supabase.from("comprehension_sentences").insert(sentenceRows);
    if (sentencesError) {
      console.error(`  Sentences insert failed: ${sentencesError.message}`);
      process.exit(1);
    }

    const questionRows = script.questions.map((question, index) => ({
      script_id: scriptId,
      question_text: questionText(question),
      option_a: question.options[0],
      option_b: question.options[1],
      option_c: question.options[2],
      option_d: question.options[3],
      correct_option: question.correct,
      sequence_order: index,
    }));

    const { error: questionsError } = await supabase.from("comprehension_questions").insert(questionRows);
    if (questionsError) {
      console.error(`  Questions insert failed: ${questionsError.message}`);
      process.exit(1);
    }

    console.log(`  ✓ ${script.sentences.length} sentences, ${script.questions.length} questions`);
  }

  console.log("\nDone. Generate audio per sentence in Content → Games → Comprehension.");
}

void main();
