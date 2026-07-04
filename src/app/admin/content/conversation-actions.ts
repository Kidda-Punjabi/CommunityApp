"use server";

import { requireAdminFromActions } from "@/app/admin/content/actions";
import { DEFAULT_VETTED_VOICE_ID } from "@/lib/elevenlabs/constants";
import type { AudioAssetStatus } from "@/lib/audio/types";
import {
  loadConversationExchangeAudioCoverage,
  type ScenarioAudioCoverageSummary,
} from "@/lib/conversation/exchange-audio-audit";
import { revalidatePath } from "next/cache";

const ADMIN_GAMES_PATH = "/admin/content/games";

export type ConversationActionResult = { error?: string; success?: string };

export type AdminConversationScenario = {
  id: string;
  character_id: string;
  title: string;
  description: string | null;
  difficulty: number | null;
  duration_minutes: number | null;
  display_order: number;
  active: boolean;
};

export type AdminConversationGlobalCharacter = {
  id: string;
  name: string;
  role: string;
  active: boolean;
};

export type AdminConversationScenarioCharacter = {
  id: string;
  scenario_id: string;
  name: string;
  role_label: string | null;
  default_voice_id: string | null;
  is_player_role: boolean;
  display_order: number;
};

export type AdminConversationTurn = {
  id: string;
  scenario_id: string;
  scenario_character_id: string;
  sequence_order: number;
  gurmukhi_text: string;
  romanised_text: string;
  english_translation: string | null;
  audio_url: string | null;
  requires_audio: boolean;
};

export type AdminConversationData = {
  scenarios: AdminConversationScenario[];
  globalCharacters: AdminConversationGlobalCharacter[];
  castByScenario: Record<string, AdminConversationScenarioCharacter[]>;
  turnsByScenario: Record<string, AdminConversationTurn[]>;
  audioStatusByTurnId: Record<string, AudioAssetStatus>;
  exchangeAudioCoverage: ScenarioAudioCoverageSummary[];
  error?: string;
};

function parseDifficulty(value: FormDataEntryValue | null): number | null {
  const raw = (value as string)?.trim();
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return null;
  return Math.min(5, Math.max(1, n));
}

function parseDuration(value: FormDataEntryValue | null): number | null {
  const raw = (value as string)?.trim();
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n <= 0) return null;
  return n;
}

function revalidate() {
  revalidatePath(ADMIN_GAMES_PATH);
  revalidatePath("/dashboard/games/conversation-practice");
}

function isMissingTable(message: string, table: string): boolean {
  return message.toLowerCase().includes(table) && message.toLowerCase().includes("does not exist");
}

export async function loadConversationAdminData(): Promise<AdminConversationData> {
  try {
    const supabase = await requireAdminFromActions();

    const [scenariosResult, globalCharsResult, castResult, turnsResult] = await Promise.all([
      supabase
        .from("conversation_scenarios")
        .select("*")
        .order("display_order", { ascending: true }),
      supabase.from("conversation_characters").select("id, name, role, active").order("display_order"),
      supabase
        .from("conversation_scenario_characters")
        .select("*")
        .order("display_order", { ascending: true }),
      supabase
        .from("conversation_turns")
        .select("*")
        .order("sequence_order", { ascending: true }),
    ]);

    const error =
      scenariosResult.error?.message ??
      globalCharsResult.error?.message ??
      castResult.error?.message ??
      turnsResult.error?.message;

    if (error) {
      if (
        isMissingTable(error, "conversation_turns") ||
        isMissingTable(error, "conversation_scenario_characters")
      ) {
        return {
          scenarios: (scenariosResult.data ?? []) as AdminConversationScenario[],
          globalCharacters: (globalCharsResult.data ?? []) as AdminConversationGlobalCharacter[],
          castByScenario: {},
          turnsByScenario: {},
          audioStatusByTurnId: {},
          exchangeAudioCoverage: [],
          error: `${error} Run supabase/conversation-practice-turns.sql first.`,
        };
      }

      return {
        scenarios: [],
        globalCharacters: [],
        castByScenario: {},
        turnsByScenario: {},
        audioStatusByTurnId: {},
        exchangeAudioCoverage: [],
        error,
      };
    }

    const castByScenario: Record<string, AdminConversationScenarioCharacter[]> = {};
    for (const row of castResult.data ?? []) {
      const cast = row as AdminConversationScenarioCharacter;
      if (!castByScenario[cast.scenario_id]) castByScenario[cast.scenario_id] = [];
      castByScenario[cast.scenario_id].push(cast);
    }

    const turnsByScenario: Record<string, AdminConversationTurn[]> = {};
    const allTurnIds: string[] = [];
    for (const row of turnsResult.data ?? []) {
      const turn = row as AdminConversationTurn;
      allTurnIds.push(turn.id);
      if (!turnsByScenario[turn.scenario_id]) turnsByScenario[turn.scenario_id] = [];
      turnsByScenario[turn.scenario_id].push(turn);
    }

    const audioStatusByTurnId: Record<string, AudioAssetStatus> = {};
    if (allTurnIds.length > 0) {
      const { data: audioAssets } = await supabase
        .from("audio_assets")
        .select("content_id, status")
        .eq("content_type", "conversation_turn")
        .in("content_id", allTurnIds);

      for (const asset of audioAssets ?? []) {
        audioStatusByTurnId[asset.content_id as string] = asset.status as AudioAssetStatus;
      }
    }

    let exchangeAudioCoverage: ScenarioAudioCoverageSummary[] = [];
    try {
      const coverage = await loadConversationExchangeAudioCoverage(supabase);
      exchangeAudioCoverage = coverage.summaries;
    } catch {
      exchangeAudioCoverage = [];
    }

    return {
      scenarios: (scenariosResult.data ?? []) as AdminConversationScenario[],
      globalCharacters: (globalCharsResult.data ?? []) as AdminConversationGlobalCharacter[],
      castByScenario,
      turnsByScenario,
      audioStatusByTurnId,
      exchangeAudioCoverage,
    };
  } catch (e) {
    return {
      scenarios: [],
      globalCharacters: [],
      castByScenario: {},
      turnsByScenario: {},
      audioStatusByTurnId: {},
      exchangeAudioCoverage: [],
      error: e instanceof Error ? e.message : "Failed to load conversation content.",
    };
  }
}

export async function createConversationScenario(
  _prev: ConversationActionResult,
  formData: FormData
): Promise<ConversationActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const characterId = (formData.get("character_id") as string)?.trim();
    const title = (formData.get("title") as string)?.trim();

    if (!characterId || !title) {
      return { error: "Learner role and title are required." };
    }

    const { data: scenario, error } = await supabase
      .from("conversation_scenarios")
      .insert({
        character_id: characterId,
        title,
        description: ((formData.get("description") as string) || "").trim() || null,
        difficulty: parseDifficulty(formData.get("difficulty")),
        duration_minutes: parseDuration(formData.get("duration_minutes")),
        display_order: parseInt((formData.get("display_order") as string) || "0", 10) || 0,
        active: formData.get("active") === "on",
      })
      .select("id")
      .single();

    if (error || !scenario) {
      return { error: error?.message ?? "Failed to create script." };
    }

    revalidate();
    return { success: "Script created — add at least two characters, then turns." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create script." };
  }
}

export async function updateConversationScenario(
  _prev: ConversationActionResult,
  formData: FormData
): Promise<ConversationActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const id = formData.get("id") as string;
    const characterId = (formData.get("character_id") as string)?.trim();
    const title = (formData.get("title") as string)?.trim();

    if (!id || !characterId || !title) {
      return { error: "Missing required fields." };
    }

    const { error } = await supabase
      .from("conversation_scenarios")
      .update({
        character_id: characterId,
        title,
        description: ((formData.get("description") as string) || "").trim() || null,
        difficulty: parseDifficulty(formData.get("difficulty")),
        duration_minutes: parseDuration(formData.get("duration_minutes")),
        display_order: parseInt((formData.get("display_order") as string) || "0", 10) || 0,
        active: formData.get("active") === "on",
      })
      .eq("id", id);

    if (error) return { error: error.message };

    revalidate();
    return { success: "Script saved." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save script." };
  }
}

export async function deleteConversationScenario(scenarioId: string): Promise<ConversationActionResult> {
  try {
    const supabase = await requireAdminFromActions();

    const { data: turns } = await supabase
      .from("conversation_turns")
      .select("id")
      .eq("scenario_id", scenarioId);

    const turnIds = (turns ?? []).map((row) => row.id as string);
    if (turnIds.length > 0) {
      await supabase
        .from("audio_assets")
        .delete()
        .eq("content_type", "conversation_turn")
        .in("content_id", turnIds);
    }

    const { error } = await supabase.from("conversation_scenarios").delete().eq("id", scenarioId);
    if (error) return { error: error.message };

    revalidate();
    return { success: "Script deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete script." };
  }
}

export async function createConversationScenarioCharacter(
  _prev: ConversationActionResult,
  formData: FormData
): Promise<ConversationActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const scenarioId = (formData.get("scenario_id") as string)?.trim();
    const name = (formData.get("name") as string)?.trim();

    if (!scenarioId || !name) {
      return { error: "Character name is required." };
    }

    const isPlayerRole = formData.get("is_player_role") === "on";
    const voiceId = ((formData.get("default_voice_id") as string) || "").trim() || DEFAULT_VETTED_VOICE_ID;

    const { error } = await supabase.from("conversation_scenario_characters").insert({
      scenario_id: scenarioId,
      name,
      role_label: ((formData.get("role_label") as string) || "").trim() || null,
      default_voice_id: voiceId,
      is_player_role: isPlayerRole,
      display_order: parseInt((formData.get("display_order") as string) || "0", 10) || 0,
    });

    if (error) return { error: error.message };

    revalidate();
    return { success: "Character added." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add character." };
  }
}

export async function updateConversationScenarioCharacter(
  _prev: ConversationActionResult,
  formData: FormData
): Promise<ConversationActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const id = formData.get("id") as string;
    const name = (formData.get("name") as string)?.trim();

    if (!id || !name) return { error: "Character name is required." };

    const voiceId = ((formData.get("default_voice_id") as string) || "").trim() || DEFAULT_VETTED_VOICE_ID;

    const { error } = await supabase
      .from("conversation_scenario_characters")
      .update({
        name,
        role_label: ((formData.get("role_label") as string) || "").trim() || null,
        default_voice_id: voiceId,
        is_player_role: formData.get("is_player_role") === "on",
        display_order: parseInt((formData.get("display_order") as string) || "0", 10) || 0,
      })
      .eq("id", id);

    if (error) return { error: error.message };

    revalidate();
    return { success: "Character saved." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save character." };
  }
}

export async function deleteConversationScenarioCharacter(
  characterId: string
): Promise<ConversationActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const { error } = await supabase
      .from("conversation_scenario_characters")
      .delete()
      .eq("id", characterId);

    if (error) return { error: error.message };

    revalidate();
    return { success: "Character removed." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to remove character." };
  }
}

export async function createConversationTurn(
  _prev: ConversationActionResult,
  formData: FormData
): Promise<ConversationActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const scenarioId = (formData.get("scenario_id") as string)?.trim();
    const scenarioCharacterId = (formData.get("scenario_character_id") as string)?.trim();
    const gurmukhi = (formData.get("gurmukhi_text") as string)?.trim();
    const romanised = (formData.get("romanised_text") as string)?.trim();

    if (!scenarioId || !scenarioCharacterId || !gurmukhi || !romanised) {
      return { error: "Speaker and Gurmukhi/Romanised text are required." };
    }

    const requiresAudio = formData.get("requires_audio") === "on";

    const { error } = await supabase.from("conversation_turns").insert({
      scenario_id: scenarioId,
      scenario_character_id: scenarioCharacterId,
      sequence_order: parseInt((formData.get("sequence_order") as string) || "1", 10) || 1,
      gurmukhi_text: gurmukhi,
      romanised_text: romanised,
      english_translation: ((formData.get("english_translation") as string) || "").trim() || null,
      requires_audio: requiresAudio,
    });

    if (error) return { error: error.message };

    revalidate();
    return { success: "Turn added." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add turn." };
  }
}

export async function updateConversationTurn(
  _prev: ConversationActionResult,
  formData: FormData
): Promise<ConversationActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const id = formData.get("id") as string;
    const scenarioCharacterId = (formData.get("scenario_character_id") as string)?.trim();
    const gurmukhi = (formData.get("gurmukhi_text") as string)?.trim();
    const romanised = (formData.get("romanised_text") as string)?.trim();

    if (!id || !scenarioCharacterId || !gurmukhi || !romanised) {
      return { error: "Missing required fields." };
    }

    const { error } = await supabase
      .from("conversation_turns")
      .update({
        scenario_character_id: scenarioCharacterId,
        sequence_order: parseInt((formData.get("sequence_order") as string) || "1", 10) || 1,
        gurmukhi_text: gurmukhi,
        romanised_text: romanised,
        english_translation: ((formData.get("english_translation") as string) || "").trim() || null,
        requires_audio: formData.get("requires_audio") === "on",
      })
      .eq("id", id);

    if (error) return { error: error.message };

    revalidate();
    return { success: "Turn saved." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save turn." };
  }
}

export async function deleteConversationTurn(turnId: string): Promise<ConversationActionResult> {
  try {
    const supabase = await requireAdminFromActions();

    await supabase
      .from("audio_assets")
      .delete()
      .eq("content_type", "conversation_turn")
      .eq("content_id", turnId);

    const { error } = await supabase.from("conversation_turns").delete().eq("id", turnId);
    if (error) return { error: error.message };

    revalidate();
    return { success: "Turn deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete turn." };
  }
}
