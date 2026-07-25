/**
 * One-off: generate Kids bedtime story audio via ElevenLabs → Supabase.
 *
 * - Uses voice ttyKbP9zTIRyRCN6b2Ye (Yatin — Punjabi Customer Support)
 * - Script text = text_gurmukhi only
 * - Inserts audio_assets with status = 'none' (NOT approved — needs native review)
 * - Idempotent: skips stories that already have audio_asset_id
 *
 * Usage:
 *   npx tsx scripts/generate-bedtime-story-audio-batch.ts
 *   npx tsx scripts/generate-bedtime-story-audio-batch.ts --limit=2
 *   npx tsx scripts/generate-bedtime-story-audio-batch.ts --story-id=<uuid>
 *   npx tsx scripts/generate-bedtime-story-audio-batch.ts --pause-ms=1500
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ELEVENLABS_API_KEY
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicUrlForAudioPath } from "../src/lib/audio/storage";
import { PUNJABI_LESSON_VOICE_ID } from "../src/lib/elevenlabs/constants";
import { getPronunciationDictionaryLocator } from "../src/lib/elevenlabs/pronunciation-dictionary";
import { synthesizeSpeech } from "../src/lib/elevenlabs/server";

const BUCKET = "bedtime-story-audio";
const CONTENT_TYPE = "bedtime_story";
const VOICE_ID = PUNJABI_LESSON_VOICE_ID;

type StoryRow = {
  id: string;
  title: string;
  text_gurmukhi: string | null;
  audio_asset_id: string | null;
  display_order: number;
};

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

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit?.slice(prefix.length);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureBedtimeStoryAudioBucket(supabase: SupabaseClient) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`Failed to list buckets: ${listError.message}`);
  }

  if ((buckets ?? []).some((bucket) => bucket.id === BUCKET || bucket.name === BUCKET)) {
    console.log(`Bucket "${BUCKET}" already exists.`);
    return;
  }

  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 52_428_800,
    allowedMimeTypes: ["audio/mpeg", "audio/mp3", "audio/wav"],
  });

  if (error && !error.message.toLowerCase().includes("already exists")) {
    throw new Error(`Failed to create bucket "${BUCKET}": ${error.message}`);
  }

  console.log(`Created public bucket "${BUCKET}".`);
}

async function findExistingAsset(
  supabase: SupabaseClient,
  storyId: string
): Promise<{ id: string; status: string; audio_url: string | null } | null> {
  const { data, error } = await supabase
    .from("audio_assets")
    .select("id, status, audio_url")
    .eq("content_type", CONTENT_TYPE)
    .eq("content_id", storyId)
    .maybeSingle();

  if (error) throw new Error(`audio_assets lookup failed: ${error.message}`);
  return data;
}

async function processStory(
  supabase: SupabaseClient,
  story: StoryRow,
  pronunciationLocators: Awaited<
    ReturnType<typeof getPronunciationDictionaryLocator>
  >[] | undefined
): Promise<{
  outcome: "generated" | "linked_existing" | "skipped";
  charactersSent: number;
  assetId?: string;
}> {
  if (story.audio_asset_id) {
    return { outcome: "skipped", charactersSent: 0, assetId: story.audio_asset_id };
  }

  const existing = await findExistingAsset(supabase, story.id);
  if (existing) {
    const { error: linkError } = await supabase
      .from("kid_bedtime_stories")
      .update({ audio_asset_id: existing.id })
      .eq("id", story.id)
      .is("audio_asset_id", null);

    if (linkError) {
      throw new Error(`Failed to link existing asset for ${story.id}: ${linkError.message}`);
    }

    console.log(`  linked existing audio_assets ${existing.id} (status=${existing.status})`);
    return { outcome: "linked_existing", charactersSent: 0, assetId: existing.id };
  }

  const scriptText = story.text_gurmukhi?.trim() ?? "";
  if (!scriptText) {
    throw new Error(`Story ${story.id} (${story.title}) has empty text_gurmukhi.`);
  }

  const synth = await synthesizeSpeech({
    text: scriptText,
    voiceId: VOICE_ID,
    pronunciationDictionaryLocators: pronunciationLocators,
  });

  const storagePath = `${story.id}.mp3`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, synth.audio, {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Upload failed for ${story.id}: ${uploadError.message}`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const audioUrl = publicUrlForAudioPath(supabaseUrl, BUCKET, storagePath);

  const { data: asset, error: insertError } = await supabase
    .from("audio_assets")
    .insert({
      content_type: CONTENT_TYPE,
      content_id: story.id,
      script_text: scriptText,
      storage_path: storagePath,
      audio_url: audioUrl,
      status: "none",
    })
    .select("id, status")
    .single();

  if (insertError || !asset) {
    throw new Error(
      `audio_assets insert failed for ${story.id}: ${insertError?.message ?? "no row"}`
    );
  }

  if (asset.status !== "none") {
    throw new Error(
      `Refusing unexpected status "${asset.status}" for new bedtime_story asset ${asset.id}`
    );
  }

  const { error: updateError } = await supabase
    .from("kid_bedtime_stories")
    .update({ audio_asset_id: asset.id })
    .eq("id", story.id);

  if (updateError) {
    throw new Error(`Failed to set audio_asset_id on story ${story.id}: ${updateError.message}`);
  }

  return {
    outcome: "generated",
    charactersSent: synth.normalizedText.length,
    assetId: asset.id,
  };
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error("Missing ELEVENLABS_API_KEY.");
    process.exit(1);
  }

  if (VOICE_ID !== "ttyKbP9zTIRyRCN6b2Ye") {
    console.error("Unexpected voice ID — aborting. Expected ttyKbP9zTIRyRCN6b2Ye.");
    process.exit(1);
  }

  const limit = Math.max(1, parseInt(argValue("limit") ?? "9999", 10));
  const pauseMs = Math.max(0, parseInt(argValue("pause-ms") ?? "1500", 10));
  const storyId = argValue("story-id");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await ensureBedtimeStoryAudioBucket(supabase);

  let query = supabase
    .from("kid_bedtime_stories")
    .select("id, title, text_gurmukhi, audio_asset_id, display_order")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (storyId) {
    query = query.eq("id", storyId);
  } else {
    query = query.is("audio_asset_id", null).limit(limit);
  }

  const { data: stories, error } = await query;
  if (error) {
    console.error("Failed to load stories:", error.message);
    process.exit(1);
  }

  const rows = (stories ?? []) as StoryRow[];
  if (rows.length === 0) {
    console.log("Nothing to do — no stories with null audio_asset_id.");
    return;
  }

  console.log(
    `Processing ${rows.length} stor${rows.length === 1 ? "y" : "ies"} with voice ${VOICE_ID}…`
  );

  const locator = await getPronunciationDictionaryLocator(supabase);
  const pronunciationLocators = locator ? [locator] : undefined;

  let generated = 0;
  let linked = 0;
  let skipped = 0;
  let failed = 0;
  let charactersSent = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const story = rows[i];
    console.log(`\n[${i + 1}/${rows.length}] ${story.title} (${story.id})`);

    try {
      const result = await processStory(supabase, story, pronunciationLocators);
      charactersSent += result.charactersSent;

      if (result.outcome === "generated") {
        generated += 1;
        console.log(
          `  generated → asset ${result.assetId} (${result.charactersSent} chars) status=none`
        );
      } else if (result.outcome === "linked_existing") {
        linked += 1;
      } else {
        skipped += 1;
        console.log("  skipped (already has audio_asset_id)");
      }
    } catch (err) {
      failed += 1;
      console.error(`  FAILED: ${err instanceof Error ? err.message : err}`);
    }

    if (i < rows.length - 1 && pauseMs > 0) {
      await sleep(pauseMs);
    }
  }

  // Verification snapshot
  const { data: allStories } = await supabase
    .from("kid_bedtime_stories")
    .select("id, audio_asset_id");
  const { data: assets } = await supabase
    .from("audio_assets")
    .select("id, status")
    .eq("content_type", CONTENT_TYPE);

  const withAudio = (allStories ?? []).filter((row) => row.audio_asset_id).length;
  const statusCounts = (assets ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log("\n—— Summary ——");
  console.log(`generated: ${generated}`);
  console.log(`linked existing: ${linked}`);
  console.log(`skipped: ${skipped}`);
  console.log(`failed: ${failed}`);
  console.log(`ElevenLabs characters sent (normalized): ${charactersSent}`);
  console.log(`stories with audio_asset_id: ${withAudio}/${(allStories ?? []).length}`);
  console.log(`bedtime_story audio_assets by status:`, statusCounts);

  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
