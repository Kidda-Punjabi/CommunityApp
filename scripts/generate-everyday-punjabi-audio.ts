/**
 * Generate approved TTS for Everyday Punjabi (Community week) flashcards
 * that still have no playable audio (no content_id asset and no script match).
 *
 * Usage:
 *   npx tsx scripts/generate-everyday-punjabi-audio.ts --dry-run
 *   npx tsx scripts/generate-everyday-punjabi-audio.ts
 *   npx tsx scripts/generate-everyday-punjabi-audio.ts --pause-ms=800
 *   npx tsx scripts/generate-everyday-punjabi-audio.ts --limit=5
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ELEVENLABS_API_KEY
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateAndAutoApproveContentAudio } from "../src/lib/audio/generate-audio";
import {
  gurmukhiScriptFromBack,
  loadTopicCardAudioUrls,
} from "../src/lib/free-lessons/topic-card-audio";

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

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function sleep(ms: number) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function resolveReviewerId(supabase: SupabaseClient): Promise<string | null> {
  const fromArg = argValue("reviewer-id");
  if (fromArg) return fromArg;

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .in("app_role", ["master_admin", "community_lead"])
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("Could not load reviewer profile:", error.message);
    return null;
  }

  return (data as { id: string } | null)?.id ?? null;
}

async function main() {
  loadEnvLocal();

  const dryRun = hasFlag("dry-run");
  const pauseMs = Number(argValue("pause-ms") ?? "800");
  const limit = Number(argValue("limit") ?? "0");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!dryRun && !process.env.ELEVENLABS_API_KEY) {
    throw new Error("Missing ELEVENLABS_API_KEY");
  }

  const supabase = createClient(url, key);
  const reviewerId = await resolveReviewerId(supabase);
  if (!reviewerId) throw new Error("No profile found for reviewed_by");

  const { data: sets, error: setsError } = await supabase
    .from("flashcard_sets")
    .select("id, name, week_number")
    .eq("course_association", "community")
    .ilike("name", "Week %")
    .order("name", { ascending: true });

  if (setsError) throw setsError;

  function weekFromName(name: string): number | null {
    const match = name.match(/^Week\s+(\d+)\b/i);
    if (!match) return null;
    const week = Number(match[1]);
    return Number.isFinite(week) ? week : null;
  }

  const cards: Array<{
    id: string;
    front_text: string;
    back_text: string;
    week_number: number;
  }> = [];

  for (const set of sets ?? []) {
    const week = set.week_number ?? weekFromName(set.name);
    if (week == null) continue;
    const { data: rows, error } = await supabase
      .from("flashcards")
      .select("id, front_text, back_text")
      .eq("deck_id", set.id);
    if (error) throw error;
    for (const row of rows ?? []) {
      cards.push({
        id: row.id,
        front_text: row.front_text,
        back_text: row.back_text,
        week_number: week,
      });
    }
  }

  const audioById = await loadTopicCardAudioUrls(supabase, cards);
  let missing = cards.filter((card) => !audioById.has(card.id));
  if (limit > 0) missing = missing.slice(0, limit);

  console.log(
    `Community week cards: ${cards.length}; already playable: ${audioById.size}; to generate: ${missing.length}${dryRun ? " (dry-run)" : ""}`
  );

  let generated = 0;
  let failed = 0;
  let skipped = 0;

  for (const card of missing) {
    const script = gurmukhiScriptFromBack(card.back_text);
    if (!script) {
      console.warn(`  skip empty script — W${card.week_number} ${card.front_text}`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] W${card.week_number} ${card.front_text} → ${script}`);
      generated++;
      continue;
    }

    const result = await generateAndAutoApproveContentAudio(supabase, "flashcard", card.id, {
      scriptOverride: script,
      reviewerId,
    });

    if (!result.ok) {
      if (result.skipped) {
        skipped++;
        console.log(`  skipped existing — W${card.week_number} ${card.front_text}`);
      } else {
        failed++;
        console.error(`  failed — W${card.week_number} ${card.front_text}: ${result.error}`);
      }
      continue;
    }

    generated++;
    console.log(`  ok — W${card.week_number} ${card.front_text}`);
    if (pauseMs > 0) await sleep(pauseMs);
  }

  console.log({ generated, skipped, failed });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
