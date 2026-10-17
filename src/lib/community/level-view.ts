import "server-only";

import { PUNJABI_LESSON_VOICE_ID } from "@/lib/elevenlabs/constants";
import {
  cooldownUntil,
  failedRetakeAt,
  levelEstablishedAt,
  xpRoad,
  xpTargetForLevel,
  type LevelHistoryRow,
} from "@/lib/community/level-progress";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LevelExample = {
  roman: string | null;
  meaning: string;
  audioUrl: string | null;
};

export type LevelView = {
  level: number;
  timezone: string;
  mainSessionId: string | null;
  pod: { id: string; name: string } | null;
  mates: { userId: string; name: string; level: number | null }[];
  understanding: number | null;
  speaking: number | null;
  placedAt: string | null;
  upFrom: number | null;
  done: number;
  goal: number;
  percent: number;
  unlocked: boolean;
  breakdown: string;
  cooldownUntil: string | null;
  cooldownDays: number;
};

function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

async function signedClip(admin: SupabaseClient, path: string | undefined): Promise<string | null> {
  if (!path) return null;
  const signed = await admin.storage.from("placement-audio").createSignedUrl(path, 60 * 30);
  return signed.data?.signedUrl ?? null;
}

export async function loadLevelView(admin: SupabaseClient, userId: string): Promise<LevelView | null> {
  const [{ data: profile }, { data: meta }, { data: settings }, { data: history }, { data: attempt }] = await Promise.all([
    admin.from("profiles").select("kidda_level, timezone, total_xp, xp_at_level_start").eq("id", userId).maybeSingle(),
    admin.from("community_memberships_meta").select("main_session_id, pod_id").eq("user_id", userId).maybeSingle(),
    admin.from("community_level_settings").select("xp_to_unlock, retake_cooldown_days").eq("id", 1).maybeSingle(),
    admin.from("kidda_level_history").select("from_level, to_level, source, created_at").eq("user_id", userId).order("created_at"),
    admin
      .from("placement_test_attempts")
      .select("understanding_level, speaking_level, completed_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (profile?.kidda_level == null) return null;
  const level = profile.kidda_level as number;
  const rows: LevelHistoryRow[] = (history ?? []).map((row) => ({
    fromLevel: row.from_level as number | null,
    toLevel: row.to_level as number,
    source: row.source as LevelHistoryRow["source"],
    createdAt: row.created_at as string,
  }));
  const established = levelEstablishedAt(rows, level);
  const rise = [...rows].reverse().find((row) => row.toLevel === level && (row.fromLevel == null || row.fromLevel < row.toLevel));
  const earned = Math.max(0, Number(profile.total_xp ?? 0) - Number(profile.xp_at_level_start ?? 0));
  const target = xpTargetForLevel(level, (settings?.xp_to_unlock as Record<string, number> | null) ?? null);
  const progress = level >= 9 || target == null
    ? { earned: 0, done: 0, percent: 100, target: 0, unlocked: false }
    : { ...xpRoad(earned, target), done: Math.min(earned, target) };
  const { data: awards } = await admin
    .from("xp_awards")
    .select("source, xp")
    .eq("user_id", userId)
    .gte("created_at", established ?? "1970-01-01T00:00:00Z");
  const buckets = { sessions: 0, games: 0, lessons: 0 };
  for (const award of awards ?? []) {
    const amount = Number(award.xp ?? 0);
    if (award.source === "session_main" || award.source === "session_bonus") buckets.sessions += amount;
    else if (award.source === "game" || award.source === "quiz" || award.source === "flashcard") buckets.games += amount;
    else buckets.lessons += amount;
  }
  const breakdown = `sessions ${buckets.sessions} · games ${buckets.games} · lessons ${buckets.lessons}`;
  const cooling = cooldownUntil(failedRetakeAt(rows), (settings?.retake_cooldown_days as number) ?? 28);
  let pod: LevelView["pod"] = null;
  let mates: LevelView["mates"] = [];
  if (meta?.pod_id) {
    const [{ data: podRow }, { data: members }] = await Promise.all([
      admin.from("pods").select("id, name").eq("id", meta.pod_id).maybeSingle(),
      admin.from("pod_members").select("user_id, profiles(full_name, kidda_level)").eq("pod_id", meta.pod_id),
    ]);
    if (podRow) pod = { id: podRow.id as string, name: podRow.name as string };
    mates = (members ?? []).map((member) => {
      const person = one(member.profiles as { full_name: string | null; kidda_level: number | null } | { full_name: string | null; kidda_level: number | null }[] | null);
      return {
        userId: member.user_id as string,
        name: member.user_id === userId ? "You" : person?.full_name?.split(" ")[0] || "Member",
        level: person?.kidda_level ?? null,
      };
    });
    mates.sort((a, b) => (a.name === "You" ? -1 : b.name === "You" ? 1 : 0));
  }
  return {
    level,
    timezone: (profile.timezone as string) || "Europe/London",
    mainSessionId: (meta?.main_session_id as string | null) ?? null,
    pod,
    mates,
    understanding: attempt ? (attempt.understanding_level as number | null) : null,
    speaking: attempt ? (attempt.speaking_level as number | null) : null,
    placedAt: rise?.createdAt ?? null,
    upFrom: rise?.fromLevel ?? null,
    done: progress.done,
    goal: progress.target,
    percent: progress.percent,
    unlocked: progress.unlocked && !cooling,
    breakdown,
    cooldownUntil: cooling?.toISOString() ?? null,
    cooldownDays: (settings?.retake_cooldown_days as number) ?? 28,
  };
}

export async function loadLevelExample(admin: SupabaseClient, level: number): Promise<LevelExample | null> {
  const itemId = level === 0 ? "L0a" : `L${level}U1`;
  const { data: item } = await admin
    .from("placement_test_items")
    .select("id, roman, options")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return null;
  const options = (item.options as { id: string; label: string; correct?: boolean }[]) ?? [];
  const meaning = options.find((option) => option.correct)?.label ?? options[0]?.label ?? "";
  const { data: clips } = await admin
    .from("placement_test_audio")
    .select("option_id, storage_path, created_at")
    .eq("item_id", itemId)
    .eq("voice_id", PUNJABI_LESSON_VOICE_ID)
    .order("created_at", { ascending: false });
  const prompt = (clips ?? []).find((clip) => (clip.option_id as string | null) == null || clip.option_id === "prompt");
  const fallback = clips?.[0];
  return {
    roman: (item.roman as string | null) ?? null,
    meaning,
    audioUrl: await signedClip(admin, (prompt ?? fallback)?.storage_path as string | undefined),
  };
}

export function formatLevelDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone }).format(new Date(iso));
}
