import "server-only";

import {
  applyPlacementAnswer,
  finishPlacement,
  initialPlacementState,
  scorePlacement,
  startLevelFromProfile,
  type PlacementState,
} from "@/lib/community/placement-engine";
import { assignMemberPod } from "@/lib/community/mutations";
import type { PublicItem, PublicOption } from "@/lib/community/placement-public";
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

function toPublic(item: BankItem, seed: string): PublicItem {
  const options = shuffle(item.options, seed).map((option) => ({
    id: option.id,
    label: option.label,
    speak: option.roman ?? (item.item_type === "S" ? option.label : null),
  }));
  return {
    id: item.id,
    prompt: item.prompt,
    roman: item.item_type === "S" ? null : item.roman,
    speak: item.roman,
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

export async function beginPlacement(admin: SupabaseClient, userId: string, understand: number, reply: number) {
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
    })
    .select("id, created_at")
    .single();
  if (error) throw error;
  return {
    attemptId: data.id as string,
    deadline: new Date(Date.parse(data.created_at) + TEST_MS).toISOString(),
    item: item ? toPublic(item, `${data.id}:${item.id}`) : null,
  };
}

async function complete(
  admin: SupabaseClient,
  attemptId: string,
  userId: string,
  state: PlacementState,
  answers: unknown[]
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
  const { error: levelError } = await admin.from("profiles").update({ kidda_level: scores.kiddaLevel }).eq("id", userId);
  if (levelError) throw levelError;
  const pod = await assignMemberPod(admin, userId);
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
    .select("id, user_id, start_level, answers, engine, created_at, completed_at")
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
    const done = await complete(admin, attemptId, userId, state, attempt.answers ?? []);
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
    const done = await complete(admin, attemptId, userId, finished, answers);
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
    item: toPublic(next, `${attemptId}:${next.id}`),
  };
}
