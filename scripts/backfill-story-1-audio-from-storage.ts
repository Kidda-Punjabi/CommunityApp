/**
 * Backfill Story 1 story_sentences.audio_url from existing files in
 * story-sentence-audio. Matches by sentence_order + sentence id in the
 * filename `{order}-{sentenceId}.mp3` — does not assume sequential listing.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-story-1-audio-from-storage.ts
 */
import { createClient } from "@supabase/supabase-js";

const AUDIO_BUCKET = "story-sentence-audio";
const STORY_ORDER = 1;

function publicObjectUrl(supabaseUrl: string, bucket: string, path: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${path}`;
}

/** Parse `01-67ba6cad-7d26-48fb-ba8a-7d433e0b03d2.mp3` → order + sentenceId */
function parseAudioFilename(name: string): { order: number; sentenceId: string } | null {
  const match = /^(\d+)-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.mp3$/i.exec(
    name
  );
  if (!match) return null;
  return { order: Number(match[1]), sentenceId: match[2].toLowerCase() };
}

function estimateMp3DurationMs(byteLength: number): number {
  const seconds = (byteLength * 8) / 128_000;
  return Math.max(500, Math.round(seconds * 1000));
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, key);

  const { data: story, error: storyError } = await supabase
    .from("kid_bedtime_stories")
    .select("id, title, display_order")
    .eq("display_order", STORY_ORDER)
    .maybeSingle();

  if (storyError || !story) {
    throw new Error(storyError?.message ?? `No story display_order=${STORY_ORDER}`);
  }

  const storyId = story.id as string;
  console.log(`Story ${story.display_order}: ${story.title} (${storyId})`);

  const { data: sentences, error: sentenceError } = await supabase
    .from("story_sentences")
    .select("id, sentence_order, audio_url, text_english")
    .eq("story_id", storyId)
    .order("sentence_order", { ascending: true });

  if (sentenceError) throw new Error(sentenceError.message);
  if (!sentences?.length) throw new Error("No story_sentences rows");

  const { data: files, error: listError } = await supabase.storage
    .from(AUDIO_BUCKET)
    .list(storyId, { limit: 100 });

  if (listError) throw new Error(listError.message);

  const bySentenceId = new Map<string, { path: string; order: number; name: string }>();
  const byOrder = new Map<number, { path: string; sentenceId: string; name: string }>();

  for (const file of files ?? []) {
    if (!file.name || file.name.endsWith("/")) continue;
    const parsed = parseAudioFilename(file.name);
    if (!parsed) {
      console.warn(`  skip unparsed filename: ${file.name}`);
      continue;
    }
    const path = `${storyId}/${file.name}`;
    bySentenceId.set(parsed.sentenceId, { path, order: parsed.order, name: file.name });
    byOrder.set(parsed.order, {
      path,
      sentenceId: parsed.sentenceId,
      name: file.name,
    });
  }

  console.log(`DB sentences: ${sentences.length}; storage audio files parsed: ${bySentenceId.size}`);

  const matches: Array<{
    order: number;
    sentenceId: string;
    file: string;
    audio_url: string;
    audio_duration_ms: number | null;
    match: "id+order" | "id-only" | "MISSING";
  }> = [];

  for (const row of sentences) {
    const sentenceId = (row.id as string).toLowerCase();
    const order = Number(row.sentence_order);
    const byId = bySentenceId.get(sentenceId);
    let match: "id+order" | "id-only" | "MISSING" = "MISSING";
    let path: string | null = null;
    let fileName: string | null = null;

    if (byId) {
      path = byId.path;
      fileName = byId.name;
      match = byId.order === order ? "id+order" : "id-only";
      if (match === "id-only") {
        console.warn(
          `  WARN order mismatch for ${sentenceId}: db=${order} file=${byId.order} — using file matched by id`
        );
      }
    }

    matches.push({
      order,
      sentenceId: row.id as string,
      file: fileName ?? "",
      audio_url: path ? publicObjectUrl(url, AUDIO_BUCKET, path) : "",
      audio_duration_ms: null,
      match,
    });
  }

  const missing = matches.filter((m) => m.match === "MISSING");
  const weak = matches.filter((m) => m.match === "id-only");
  if (missing.length) {
    console.error("Missing audio for:", missing.map((m) => m.order));
    throw new Error(`Cannot backfill: ${missing.length} sentences have no matching file`);
  }

  // Extra safety: every file order must point at the same sentence id as DB for that order
  for (const row of sentences) {
    const order = Number(row.sentence_order);
    const fileAtOrder = byOrder.get(order);
    if (!fileAtOrder) throw new Error(`No file for sentence_order=${order}`);
    if (fileAtOrder.sentenceId !== (row.id as string).toLowerCase()) {
      throw new Error(
        `Order ${order}: file uuid ${fileAtOrder.sentenceId} != row ${row.id}`
      );
    }
  }

  console.log("\nVerified matches (id + order):");
  for (const m of matches) {
    console.log(`  #${m.order} ${m.sentenceId.slice(0, 8)}… ← ${m.file} [${m.match}]`);
  }
  if (weak.length) {
    throw new Error("Aborting: order mismatches present — fix manually");
  }

  let updated = 0;
  for (const m of matches) {
    const path = `${storyId}/${m.file}`;
    let durationMs: number | null = null;
    try {
      const { data: blob, error: dlError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .download(path);
      if (!dlError && blob) {
        const buf = Buffer.from(await blob.arrayBuffer());
        durationMs = estimateMp3DurationMs(buf.byteLength);
      }
    } catch {
      /* duration optional */
    }

    const { error } = await supabase
      .from("story_sentences")
      .update({
        audio_url: m.audio_url,
        audio_duration_ms: durationMs,
        updated_at: new Date().toISOString(),
      })
      .eq("id", m.sentenceId)
      .eq("story_id", storyId);

    if (error) throw new Error(`${m.sentenceId}: ${error.message}`);
    updated++;
    console.log(`  wrote audio_url #${m.order} (~${durationMs ?? "?"}ms)`);
  }

  // Confirm no other stories touched: sample count of non-null audio outside story 1
  const { count: otherTouched } = await supabase
    .from("story_sentences")
    .select("id", { count: "exact", head: true })
    .neq("story_id", storyId)
    .not("audio_url", "is", null);

  const { data: verify } = await supabase
    .from("story_sentences")
    .select("sentence_order, audio_url")
    .eq("story_id", storyId)
    .order("sentence_order");

  const stillNull = (verify ?? []).filter((r) => !r.audio_url);
  console.log(`\nUpdated ${updated}/11. Still null: ${stillNull.length}`);
  console.log(`Other stories with audio_url set: ${otherTouched ?? 0} (should be pre-existing only)`);
  for (const row of verify ?? []) {
    console.log(`  #${row.sentence_order} ${row.audio_url}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
