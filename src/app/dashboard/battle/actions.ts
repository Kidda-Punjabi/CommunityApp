"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BATTLE_GAME_SOURCES, type BattleGameSource } from "@/lib/battle/constants";
import { initialBotSkill } from "@/lib/battle/bot-opponent";
import { ensureCurrentBattleRound } from "@/lib/battle/round-lifecycle";
import { loadOnboardingProfile } from "@/lib/progression/load-user-progression";
import { createClient } from "@/lib/supabase/server";

export type BattleActionResult = { error?: string; sessionId?: string };

export async function createBattleSession(
  _prev: BattleActionResult,
  formData: FormData
): Promise<BattleActionResult> {
  const gameSource = String(formData.get("game_source") ?? "").trim();

  if (!BATTLE_GAME_SOURCES.includes(gameSource as BattleGameSource)) {
    return { error: "Pick a battle game type." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("battle_create_session", {
    p_game_source: gameSource,
  });

  if (error) return { error: error.message };

  const payload = data as { session_id: string };
  revalidatePath("/dashboard/battle");
  redirect(`/dashboard/battle/${payload.session_id}`);
}

export async function joinBattleByCode(
  _prev: BattleActionResult,
  formData: FormData
): Promise<BattleActionResult> {
  const code = String(formData.get("invite_code") ?? "").trim();
  if (!code) return { error: "Enter a battle code." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data, error } = await supabase.rpc("battle_join_session", {
    p_invite_code: code,
  });

  if (error) return { error: error.message };

  const payload = data as { session_id: string };
  const progression = await loadOnboardingProfile(supabase, user.id);
  await ensureCurrentBattleRound(supabase, payload.session_id, progression.learnerLevel);

  revalidatePath("/dashboard/battle");
  redirect(`/dashboard/battle/${payload.session_id}`);
}

export async function abandonBattleSession(sessionId: string): Promise<BattleActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("battle_abandon_session", {
    p_session_id: sessionId,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/battle/${sessionId}`);
  return { sessionId };
}

export async function quickMatchBattle(
  _prev: BattleActionResult,
  formData: FormData
): Promise<BattleActionResult> {
  const gameSource = String(formData.get("game_source") ?? "gender_sort").trim();

  if (!BATTLE_GAME_SOURCES.includes(gameSource as BattleGameSource)) {
    return { error: "Could not start quick match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data, error } = await supabase.rpc("battle_quick_match", {
    p_game_source: gameSource,
  });

  if (error) return { error: error.message };

  const payload = data as { session_id: string; matched?: boolean };
  const progression = await loadOnboardingProfile(supabase, user.id);
  if (payload.matched) {
    await ensureCurrentBattleRound(supabase, payload.session_id, progression.learnerLevel);
  }

  revalidatePath("/dashboard/battle");
  revalidatePath("/dashboard/community");
  redirect(`/dashboard/battle/${payload.session_id}`);
}

export async function pairQuickMatchBot(sessionId: string): Promise<BattleActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const progression = await loadOnboardingProfile(supabase, user.id);
  const botSkill = initialBotSkill(progression.learnerLevel);

  const { error } = await supabase.rpc("battle_pair_bot_opponent", {
    p_session_id: sessionId,
    p_bot_skill: botSkill,
  });

  if (error) return { error: error.message };

  await ensureCurrentBattleRound(supabase, sessionId, progression.learnerLevel);

  revalidatePath(`/dashboard/battle/${sessionId}`);
  return { sessionId };
}
