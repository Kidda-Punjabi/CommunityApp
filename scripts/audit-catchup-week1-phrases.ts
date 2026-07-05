/**
 * Audit Week 1 phrase_reference flashcards for approved audio.
 * Usage: npx tsx scripts/audit-catchup-week1-phrases.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const PHRASE_FLASHCARD_IDS = [
  "e52227ad-365d-4587-b593-952df524168d",
  "cc893969-34e5-461d-a7ec-47e0fa7b8e59",
  "d041baef-d73c-44ee-bd66-32d1e035cf41",
  "4ece0640-aaf1-434f-9079-eccc3a044cf4",
  "a1d78591-925c-4b79-87f7-bfd4e44892b3",
  "aa9724a7-cb29-47dd-949e-9d6e9d2d480a",
];

function loadEnvLocal() {
  const p = resolve(".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    if (!process.env[k]) {
      process.env[k] = t.slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
}

async function main() {
  loadEnvLocal();
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: cards } = await sb
    .from("flashcards")
    .select("id, front_text, romanised")
    .in("id", PHRASE_FLASHCARD_IDS);

  const { data: assets } = await sb
    .from("audio_assets")
    .select("content_id, status, audio_url")
    .eq("content_type", "flashcard")
    .in("content_id", PHRASE_FLASHCARD_IDS);

  const assetById = new Map((assets ?? []).map((row) => [row.content_id, row]));

  console.log("Week 1 core phrase flashcard audio audit:\n");
  let missing = 0;

  for (const card of cards ?? []) {
    const asset = assetById.get(card.id);
    const ok = asset?.status === "approved" && asset.audio_url;
    if (!ok) missing += 1;
    console.log(
      `${ok ? "✓" : "✗"} ${card.romanised ?? card.front_text.slice(0, 40)} — ${
        asset?.status ?? "no audio_assets row"
      }`
    );
  }

  if (missing > 0) {
    console.log(
      `\n${missing} phrase(s) need flashcard TTS generated and approved before phrase_reference beats will play audio.`
    );
    console.log("Use admin Audio review after generating with content_type=flashcard.");
  } else {
    console.log("\nAll core phrases have approved audio.");
  }
}

main().catch(console.error);
