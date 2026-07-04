/**
 * Batch-generate conversation turn audio (NPC lines with requires_audio=true).
 *
 * Usage:
 *   npx tsx scripts/generate-conversation-audio-batch.ts
 *   npx tsx scripts/generate-conversation-audio-batch.ts --pause-ms=2000
 *   npx tsx scripts/generate-conversation-audio-batch.ts --turn-id=<uuid> --force
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ELEVENLABS_API_KEY
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { generateContentAudio } from "../src/lib/audio/generate-audio";

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

  const pauseMs = Math.max(0, parseInt(argValue("pause-ms") ?? "2000", 10));
  const forceTurnId = argValue("turn-id");
  const force = process.argv.includes("--force");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (forceTurnId) {
    console.log(`Generating single turn ${forceTurnId} (force=${force})…`);
    const result = await generateContentAudio(supabase, "conversation_turn", forceTurnId, { force });
    if (!result.ok) {
      console.error("Failed:", result.error);
      process.exit(1);
    }
    console.log("Done:", result.storagePath);
    return;
  }

  const { data: turns, error: turnsError } = await supabase
    .from("conversation_turns")
    .select("id, scenario_id, sequence_order, gurmukhi_text, conversation_scenarios(title)")
    .eq("requires_audio", true)
    .order("sequence_order");

  if (turnsError) {
    console.error("Failed to load turns:", turnsError.message);
    process.exit(1);
  }

  const { data: assets, error: assetsError } = await supabase
    .from("audio_assets")
    .select("content_id, status")
    .eq("content_type", "conversation_turn");

  if (assetsError) {
    console.error("Failed to load audio assets:", assetsError.message);
    process.exit(1);
  }

  const statusByTurnId = new Map(
    (assets ?? []).map((row) => [row.content_id as string, row.status as string])
  );

  const queue = (turns ?? []).filter((turn) => {
    const status = statusByTurnId.get(turn.id as string);
    return !status || status === "none";
  });

  console.log(
    `Found ${queue.length} NPC turn(s) without generated audio (${turns?.length ?? 0} total NPC lines).`
  );

  if (queue.length === 0) {
    return;
  }

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < queue.length; i += 1) {
    const turn = queue[i];
    const scenario = Array.isArray(turn.conversation_scenarios)
      ? turn.conversation_scenarios[0]
      : turn.conversation_scenarios;
    const label = `${scenario?.title ?? "Scenario"} · turn ${turn.sequence_order}`;
    const preview = (turn.gurmukhi_text as string).trim().slice(0, 40);

    const result = await generateContentAudio(supabase, "conversation_turn", turn.id as string, {
      batchMode: true,
    });

    if (!result.ok) {
      fail += 1;
      console.log(`  FAIL  [${i + 1}/${queue.length}] ${label}: ${result.error}`);
      continue;
    }

    ok += 1;
    console.log(`  OK    [${i + 1}/${queue.length}] ${label} (${preview}…) → ${result.storagePath}`);

    if (i + 1 < queue.length && pauseMs > 0) {
      await sleep(pauseMs);
    }
  }

  console.log(`\nSummary: ${ok} succeeded, ${fail} failed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
