import type { SupabaseClient } from "@supabase/supabase-js";
import type { AudioAssetStatus } from "@/lib/audio/types";
import {
  CONVERSATION_EXCHANGE_AUDIO_TYPES,
  type ConversationExchangeAudioSlot,
} from "./exchange-audio-types";

export type ExchangeAudioCoverageRow = {
  exchangeId: string;
  scenarioId: string;
  scenarioTitle: string;
  sequenceOrder: number;
  npcSetup: { required: boolean; status: AudioAssetStatus | "missing"; audioUrl: string | null };
  npcReply: { required: boolean; status: AudioAssetStatus | "missing"; audioUrl: string | null };
  playerResponse: {
    required: boolean;
    status: AudioAssetStatus | "missing";
    audioUrl: string | null;
  };
};

export type ScenarioAudioCoverageSummary = {
  scenarioId: string;
  scenarioTitle: string;
  exchangeCount: number;
  missingNpcSetup: number;
  missingNpcReply: number;
  missingPlayerResponse: number;
  pendingReview: number;
  fullyApproved: boolean;
};

type ExchangeRow = {
  id: string;
  scenario_id: string;
  sequence_order: number;
  npc_reply_gurmukhi: string | null;
  conversation_scenarios:
    | { title: string }
    | { title: string }[]
    | null;
};

type AssetRow = {
  content_type: string;
  content_id: string;
  status: AudioAssetStatus;
  audio_url: string | null;
};

function scenarioTitle(row: ExchangeRow): string {
  const scenario = Array.isArray(row.conversation_scenarios)
    ? row.conversation_scenarios[0]
    : row.conversation_scenarios;
  return scenario?.title ?? "Unknown scenario";
}

function slotStatus(
  assetsByKey: Map<string, AssetRow>,
  exchangeId: string,
  slot: ConversationExchangeAudioSlot,
  required: boolean
): ExchangeAudioCoverageRow["npcSetup"] {
  if (!required) {
    return { required: false, status: "missing", audioUrl: null };
  }

  const contentType = CONVERSATION_EXCHANGE_AUDIO_TYPES[slot];
  const asset = assetsByKey.get(`${contentType}:${exchangeId}`);
  if (!asset) {
    return { required: true, status: "missing", audioUrl: null };
  }

  return {
    required: true,
    status: asset.status,
    audioUrl: asset.audio_url?.trim() ? asset.audio_url : null,
  };
}

export async function loadConversationExchangeAudioCoverage(
  supabase: SupabaseClient
): Promise<{
  rows: ExchangeAudioCoverageRow[];
  summaries: ScenarioAudioCoverageSummary[];
}> {
  const [exchangesResult, assetsResult] = await Promise.all([
    supabase
      .from("conversation_exchanges")
      .select(
        "id, scenario_id, sequence_order, npc_reply_gurmukhi, conversation_scenarios(title)"
      )
      .order("sequence_order", { ascending: true }),
    supabase
      .from("audio_assets")
      .select("content_type, content_id, status, audio_url")
      .in("content_type", Object.values(CONVERSATION_EXCHANGE_AUDIO_TYPES)),
  ]);

  if (exchangesResult.error) {
    throw new Error(exchangesResult.error.message);
  }

  const assetsByKey = new Map<string, AssetRow>();
  for (const row of assetsResult.data ?? []) {
    assetsByKey.set(`${row.content_type}:${row.content_id}`, row as AssetRow);
  }

  const rows: ExchangeAudioCoverageRow[] = [];
  const summaryByScenario = new Map<string, ScenarioAudioCoverageSummary>();

  for (const raw of exchangesResult.data ?? []) {
    const exchange = raw as ExchangeRow;
    const title = scenarioTitle(exchange);
    const hasReply = Boolean(exchange.npc_reply_gurmukhi?.trim());

    const npcSetup = slotStatus(assetsByKey, exchange.id, "npc_setup", true);
    const npcReply = slotStatus(assetsByKey, exchange.id, "npc_reply", hasReply);
    const playerResponse = slotStatus(assetsByKey, exchange.id, "player_response", true);

    rows.push({
      exchangeId: exchange.id,
      scenarioId: exchange.scenario_id,
      scenarioTitle: title,
      sequenceOrder: exchange.sequence_order,
      npcSetup,
      npcReply,
      playerResponse,
    });

    let summary = summaryByScenario.get(exchange.scenario_id);
    if (!summary) {
      summary = {
        scenarioId: exchange.scenario_id,
        scenarioTitle: title,
        exchangeCount: 0,
        missingNpcSetup: 0,
        missingNpcReply: 0,
        missingPlayerResponse: 0,
        pendingReview: 0,
        fullyApproved: true,
      };
      summaryByScenario.set(exchange.scenario_id, summary);
    }

    summary.exchangeCount += 1;

    const bumpMissing = (
      slot: ExchangeAudioCoverageRow["npcSetup"],
      field: "missingNpcSetup" | "missingNpcReply" | "missingPlayerResponse"
    ) => {
      if (!slot.required) return;
      if (slot.status === "approved") return;
      if (slot.status === "pending_review") {
        summary!.pendingReview += 1;
        summary!.fullyApproved = false;
        return;
      }
      summary![field] += 1;
      summary!.fullyApproved = false;
    };

    bumpMissing(npcSetup, "missingNpcSetup");
    bumpMissing(npcReply, "missingNpcReply");
    bumpMissing(playerResponse, "missingPlayerResponse");
  }

  return {
    rows,
    summaries: [...summaryByScenario.values()].sort((a, b) =>
      a.scenarioTitle.localeCompare(b.scenarioTitle)
    ),
  };
}

export function isExchangeAudioApproved(
  slot: ExchangeAudioCoverageRow["npcSetup"]
): boolean {
  return slot.required && slot.status === "approved" && Boolean(slot.audioUrl);
}
