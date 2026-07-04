/**
 * Batch-generate exchange audio for Conversation Practice.
 *
 * Usage:
 *   npx tsx scripts/generate-conversation-exchange-audio-batch.ts
 *   npx tsx scripts/generate-conversation-exchange-audio-batch.ts --slot=player_response
 *   npx tsx scripts/generate-conversation-exchange-audio-batch.ts --scenario-id=<uuid>
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ELEVENLABS_API_KEY
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { generateContentAudio } from "../src/lib/audio/generate-audio";
import {
  CONVERSATION_EXCHANGE_AUDIO_TYPES,
  type ConversationExchangeAudioSlot,
} from "../src/lib/conversation/exchange-audio-types";
import {
  DEFAULT_VETTED_VOICE_ID,
  PUNJABI_CONVERSATION_PLAYER_VOICE_ID,
} from "../src/lib/elevenlabs/constants";

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

const ALL_SLOTS: ConversationExchangeAudioSlot[] = [
  "npc_setup",
  "npc_reply",
  "player_response",
];

async function resolveNpcVoiceId(
  supabase: ReturnType<typeof createClient>,
  scenarioId: string
): Promise<string> {
  const { data } = await supabase
    .from("conversation_scenario_characters")
    .select("default_voice_id, is_player_role")
    .eq("scenario_id", scenarioId)
    .eq("is_player_role", false)
    .order("display_order")
    .limit(1)
    .maybeSingle();

  const voiceId = (data?.default_voice_id as string | null)?.trim();
  return voiceId || DEFAULT_VETTED_VOICE_ID;
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
  const scenarioFilter = argValue("scenario-id");
  const slotFilter = argValue("slot") as ConversationExchangeAudioSlot | undefined;
  const slots = slotFilter ? [slotFilter] : ALL_SLOTS;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let exchangeQuery = supabase
    .from("conversation_exchanges")
    .select(
      "id, scenario_id, sequence_order, npc_setup_gurmukhi, npc_reply_gurmukhi, target_response_gurmukhi, conversation_scenarios(title)"
    )
    .order("sequence_order");

  if (scenarioFilter) {
    exchangeQuery = exchangeQuery.eq("scenario_id", scenarioFilter);
  }

  const { data: exchanges, error: exchangesError } = await exchangeQuery;
  if (exchangesError) {
    console.error("Failed to load exchanges:", exchangesError.message);
    process.exit(1);
  }

  const { data: assets, error: assetsError } = await supabase
    .from("audio_assets")
    .select("content_type, content_id, status")
    .in("content_type", Object.values(CONVERSATION_EXCHANGE_AUDIO_TYPES));

  if (assetsError) {
    console.error("Failed to load audio assets:", assetsError.message);
    process.exit(1);
  }

  const statusByKey = new Map(
    (assets ?? []).map((row) => [`${row.content_type}:${row.content_id}`, row.status as string])
  );

  type QueueItem = {
    exchangeId: string;
    slot: ConversationExchangeAudioSlot;
    label: string;
    voiceId: string;
  };

  const queue: QueueItem[] = [];
  const npcVoiceByScenario = new Map<string, string>();

  for (const exchange of exchanges ?? []) {
    const exchangeId = exchange.id as string;
    const scenarioId = exchange.scenario_id as string;
    const scenario = Array.isArray(exchange.conversation_scenarios)
      ? exchange.conversation_scenarios[0]
      : exchange.conversation_scenarios;
    const title = scenario?.title ?? "Scenario";
    const order = exchange.sequence_order as number;

    for (const slot of slots) {
      if (slot === "npc_reply" && !(exchange.npc_reply_gurmukhi as string | null)?.trim()) {
        continue;
      }

      const contentType = CONVERSATION_EXCHANGE_AUDIO_TYPES[slot];
      const status = statusByKey.get(`${contentType}:${exchangeId}`);
      if (status && status !== "none") continue;

      let voiceId = PUNJABI_CONVERSATION_PLAYER_VOICE_ID;
      if (slot !== "player_response") {
        if (!npcVoiceByScenario.has(scenarioId)) {
          npcVoiceByScenario.set(scenarioId, await resolveNpcVoiceId(supabase, scenarioId));
        }
        voiceId = npcVoiceByScenario.get(scenarioId)!;
      }

      queue.push({
        exchangeId,
        slot,
        label: `${title} · exchange ${order} · ${slot}`,
        voiceId,
      });
    }
  }

  console.log(`Found ${queue.length} exchange clip(s) to generate.`);

  if (queue.length === 0) return;

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < queue.length; i += 1) {
    const item = queue[i];
    const contentType = CONVERSATION_EXCHANGE_AUDIO_TYPES[item.slot];

    const result = await generateContentAudio(supabase, contentType, item.exchangeId, {
      batchMode: true,
      voiceId: item.voiceId,
    });

    if (!result.ok) {
      fail += 1;
      console.log(`  FAIL  [${i + 1}/${queue.length}] ${item.label}: ${result.error}`);
      continue;
    }

    ok += 1;
    console.log(`  OK    [${i + 1}/${queue.length}] ${item.label} → ${result.storagePath}`);

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
