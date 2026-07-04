/**
 * Backfill exchange-linked audio_assets from approved conversation_turn clips.
 * Matches turns to exchanges by scenario_id + Gurmukhi text.
 *
 * Usage:
 *   npx tsx scripts/sync-conversation-exchange-audio.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { CONVERSATION_EXCHANGE_AUDIO_TYPES } from "../src/lib/conversation/exchange-audio-types";

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

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: exchanges, error: exchangesError }, { data: turns, error: turnsError }, { data: assets, error: assetsError }] =
    await Promise.all([
      supabase
        .from("conversation_exchanges")
        .select("id, scenario_id, npc_setup_gurmukhi, npc_reply_gurmukhi"),
      supabase
        .from("conversation_turns")
        .select("scenario_id, gurmukhi_text, audio_url")
        .eq("requires_audio", true),
      supabase
        .from("audio_assets")
        .select("content_type, content_id, status")
        .in("content_type", Object.values(CONVERSATION_EXCHANGE_AUDIO_TYPES)),
    ]);

  if (exchangesError || turnsError || assetsError) {
    console.error(
      exchangesError?.message ?? turnsError?.message ?? assetsError?.message ?? "Load failed"
    );
    process.exit(1);
  }

  const turnAudio = new Map<string, string>();
  for (const turn of turns ?? []) {
    const audioUrl = (turn.audio_url as string | null)?.trim();
    const gurmukhi = (turn.gurmukhi_text as string).trim();
    const scenarioId = turn.scenario_id as string;
    if (audioUrl && gurmukhi) {
      turnAudio.set(`${scenarioId}:${gurmukhi}`, audioUrl);
    }
  }

  const existing = new Set(
    (assets ?? []).map((row) => `${row.content_type}:${row.content_id}`)
  );

  let created = 0;
  let skipped = 0;

  for (const exchange of exchanges ?? []) {
    const exchangeId = exchange.id as string;
    const scenarioId = exchange.scenario_id as string;
    const setupText = (exchange.npc_setup_gurmukhi as string).trim();
    const replyText = (exchange.npc_reply_gurmukhi as string | null)?.trim() ?? "";

    const slots: {
      slot: keyof typeof CONVERSATION_EXCHANGE_AUDIO_TYPES;
      text: string;
      turnUrl: string | undefined;
    }[] = [
      {
        slot: "npc_setup",
        text: setupText,
        turnUrl: turnAudio.get(`${scenarioId}:${setupText}`),
      },
    ];

    if (replyText) {
      slots.push({
        slot: "npc_reply",
        text: replyText,
        turnUrl: turnAudio.get(`${scenarioId}:${replyText}`),
      });
    }

    for (const { slot, text, turnUrl } of slots) {
      const contentType = CONVERSATION_EXCHANGE_AUDIO_TYPES[slot];
      const key = `${contentType}:${exchangeId}`;
      if (existing.has(key) || !turnUrl) {
        skipped += 1;
        continue;
      }

      const { error } = await supabase.from("audio_assets").upsert(
        {
          content_type: contentType,
          content_id: exchangeId,
          script_text: text,
          audio_url: turnUrl,
          status: "approved",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "content_type,content_id" }
      );

      if (error) {
        console.error(`Failed ${key}:`, error.message);
        continue;
      }

      created += 1;
      existing.add(key);
      console.log(`  synced ${contentType} for exchange ${exchangeId.slice(0, 8)}…`);
    }
  }

  console.log(`\nSummary: ${created} exchange clip(s) synced from turns, ${skipped} skipped.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
