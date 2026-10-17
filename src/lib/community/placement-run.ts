import "server-only";

import {
  applyPlacementAnswer,
  finishPlacement,
  initialPlacementState,
  scorePlacement,
  startLevelFromProfile,
  type PlacementState,
} from "@/lib/community/placement-engine";
import { applyRetakeResult, assertRetakeAllowed, recordPlacementLevel } from "@/lib/community/level-move";
import type { PublicItem, PublicOption } from "@/lib/community/placement-public";
import { PUNJABI_LESSON_VOICE_ID } from "@/lib/elevenlabs/constants";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { PublicItem, PublicOption };

type BankItem = {
  id: string;
  level: number;
  item_type: "U" | "S" | "SOUND";
  slot: "U1" | "U2" | "S" | "A" | "B";
  prompt: string;
  roman: string | null;
  gurmukhi: string | null;
  sort_order: number;
  options: { id: string; label: string; roman?: string | null; gurmukhi?: string | null; correct?: boolean }[];
};

const TEST_MS = 120_000;

function shuffle<T>(items: T[], seed: string): T[] {
  const copy = [...items];
  let hash = 0;
  for (const char of seed) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  for (let i = copy.length - 1; i > 0; i -= 1) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const j = hash % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function signedClip(admin: SupabaseClient, path: string | undefined): Promise<string | null> {
  if (!path) return null;
  const signed = await admin.storage.from("placement-audio").createSignedUrl(path, 60 * 30);
  return signed.data?.signedUrl ?? null;
}

async function toPublic(admin: SupabaseClient, item: BankItem, seed: string): Promise<PublicItem> {
  const { data } = await admin
    .from("placement_test_audio")
    .select("option_id, storage_path, created_at")
    .eq("item_id", item.id)
    .eq("voice_id", PUNJABI_LESSON_VOICE_ID)
    .order("created_at", { ascending: false });
  const paths = new Map<string, string>();
  for (const row of data ?? []) {
    const key = (row.option_id as string | null) ?? "prompt";
    if (!paths.has(key)) paths.set(key, row.storage_path as string);
  }
  const options = await Promise.all(
    shuffle(item.options, seed).map(async (option) => ({
      id: option.id,
      label: option.label,
      audioUrl: await signedClip(admin, paths.get(option.id)),
    }))
  );
  return {
    id: item.id,
    prompt: item.prompt,
    roman: item.item_type === "S" ? null : item.roman,
    audioUrl: await signedClip(admin, paths.get("prompt")),
    options,
    kind: item.item_type === "S" ? "say" : item.item_type === "SOUND" ? "sound" : "meaning",
  };
}

function expected(items: BankItem[], state: PlacementState): BankItem | null {
  if (state.phase === "done") return null;
  if (state.phase === "sound") {
    const sounds = items.filter((item) => item.level === 0).sort((a, b) => a.sort_order - b.sort_order);
    return sounds[state.soundIndex] ?? null;
  }
  return items.find((item) => item.level === state.L && item.slot === state.step) ?? null;
}

async function loadBank(admin: SupabaseClient): Promise<BankItem[]> {
  const { data, error } = await admin.from("placement_test_items").select("id, level, item_type, slot, prompt, roman, gurmukhi, sort_order, options");
  if (error) throw error;
  return (data ?? []) as BankItem[];
}

function parseState(value: unknown, start: number): PlacementState {
  if (!value || typeof value !== "object") return initialPlacementState(start);
  return value as PlacementState;
}

export async function beginPlacement(
  admin: SupabaseClient,
  userId: string,
  understand: number,
  reply: number,
  purpose: "placement" | "retake" = "placement"
) {
  if (purpose === "retake") {
    const allowed = await assertRetakeAllowed(admin, userId);
    if ("error" in allowed) return allowed;
  }
  const start = startLevelFromProfile(understand, reply);
  const state = initialPlacementState(start);
  const items = await loadBank(admin);
  const item = expected(items, state);
  const { data, error } = await admin
    .from("placement_test_attempts")
    .insert({
      user_id: userId,
      start_level: start,
      answers: [],
      engine: state,
      purpose,
    })
    .select("id, created_at")
    .single();
  if (error) throw error;
  return {
    attemptId: data.id as string,
    deadline: new Date(Date.parse(data.created_at) + TEST_MS).toISOString(),
    item: item ? await toPublic(admin, item, `${data.id}:${item.id}`) : null,
  };
}

async function complete(
  admin: SupabaseClient,
  attemptId: string,
  userId: string,
  state: PlacementState,
  answers: unknown[],
  purpose: string
) {
  const scores = scorePlacement(state);
  const { error } = await admin
    .from("placement_test_attempts")
    .update({
      engine: state,
      answers,
      understanding_level: scores.understanding,
      speaking_level: scores.speaking,
      kidda_level: scores.kiddaLevel,
      sound_issue: scores.soundIssue,
      timed_out: scores.timedOut,
      completed_at: new Date().toISOString(),
    })
    .eq("id", attemptId);
  if (error) throw error;
  if (purpose === "retake") {
    const outcome = await applyRetakeResult(admin, userId, scores.kiddaLevel);
    return { scores, ...outcome };
  }
  const pod = await recordPlacementLevel(admin, userId, scores.kiddaLevel);
  return { scores, podName: "name" in pod ? pod.name : null };
}

export async function answerPlacement(
  admin: SupabaseClient,
  userId: string,
  attemptId: string,
  itemId: string,
  optionId: string
) {
  const { data: attempt, error } = await admin
    .from("placement_test_attempts")
    .select("id, user_id, start_level, answers, engine, created_at, completed_at, purpose")
    .eq("id", attemptId)
    .maybeSingle();
  if (error) throw error;
  if (!attempt || attempt.user_id !== userId) return { error: "Test not found." };
  if (attempt.completed_at) return { error: "This test is already finished." };

  const items = await loadBank(admin);
  let state = parseState(attempt.engine, attempt.start_level ?? 1);
  const timedOut = Date.now() - Date.parse(attempt.created_at) > TEST_MS;
  if (timedOut) {
    state = finishPlacement(state, true);
    const done = await complete(admin, attemptId, userId, state, attempt.answers ?? [], (attempt.purpose as string) ?? "placement");
    return { timedOut: true, ...done, item: null };
  }

  const current = expected(items, state);
  if (!current || current.id !== itemId) return { error: "That question has moved on." };
  const chosen = current.options.find((option) => option.id === optionId);
  if (!chosen) return { error: "Pick one of the answers." };
  const correct = Boolean(chosen.correct);
  const answers = [
    ...((attempt.answers as unknown[]) ?? []),
    { itemId, optionId, correct, ms: Date.now() - Date.parse(attempt.created_at) },
  ];
  state = applyPlacementAnswer(state, correct);
  const next = expected(items, state);
  if (!next || state.phase === "done") {
    const finished = state.phase === "done" ? state : finishPlacement(state);
    const done = await complete(admin, attemptId, userId, finished, answers, (attempt.purpose as string) ?? "placement");
    return {
      correct,
      correctOptionId: current.options.find((option) => option.correct)?.id ?? optionId,
      item: null,
      ...done,
    };
  }

  const { error: saveError } = await admin
    .from("placement_test_attempts")
    .update({ engine: state, answers })
    .eq("id", attemptId);
  if (saveError) throw saveError;
  return {
    correct,
    correctOptionId: current.options.find((option) => option.correct)?.id ?? optionId,
    item: await toPublic(admin, next, `${attemptId}:${next.id}`),
  };
}
