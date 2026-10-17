import "server-only";

import { bandChanged } from "@/lib/community/level-progress";
import { loadLevelView } from "@/lib/community/level-view";
import { assignMemberPod } from "@/lib/community/mutations";
import type { SupabaseClient } from "@supabase/supabase-js";

async function writeHistory(
  admin: SupabaseClient,
  row: { userId: string; fromLevel: number | null; toLevel: number; source: "placement" | "retake" | "admin"; changedBy: string | null; reason?: string }
) {
  const { error } = await admin.from("kidda_level_history").insert({
    user_id: row.userId,
    from_level: row.fromLevel,
    to_level: row.toLevel,
    source: row.source,
    changed_by: row.changedBy,
    reason: row.reason?.trim() || null,
  });
  if (error) throw error;
}

export async function recordPlacementLevel(admin: SupabaseClient, userId: string, toLevel: number) {
  const { data: profile, error } = await admin.from("profiles").select("kidda_level").eq("id", userId).maybeSingle();
  if (error) throw error;
  const fromLevel = (profile?.kidda_level as number | null) ?? null;
  const { error: levelError } = await admin.from("profiles").update({ kidda_level: toLevel }).eq("id", userId);
  if (levelError) throw levelError;
  if (fromLevel !== toLevel) {
    await writeHistory(admin, { userId, fromLevel, toLevel, source: "placement", changedBy: userId });
  }
  return assignMemberPod(admin, userId);
}

export async function assertRetakeAllowed(admin: SupabaseClient, userId: string) {
  const view = await loadLevelView(admin, userId);
  if (!view) return { error: "Take the level check first." };
  if (view.level >= 9) return { error: "You're already at the top level." };
  if (view.cooldownUntil) return { error: "You can try that level check again after the cooldown." };
  if (!view.unlocked) return { error: "The level check unlocks after your main sessions." };
  return { ok: true as const };
}

export async function applyRetakeResult(admin: SupabaseClient, userId: string, scoredLevel: number) {
  const allowed = await assertRetakeAllowed(admin, userId);
  if ("error" in allowed) return allowed;
  const view = await loadLevelView(admin, userId);
  if (!view) return { error: "Take the level check first." };
  if (!retakeWouldMove(view.level, scoredLevel)) {
    await writeHistory(admin, {
      userId,
      fromLevel: view.level,
      toLevel: view.level,
      source: "retake",
      changedBy: userId,
    });
    const until = new Date(Date.now() + view.cooldownDays * 86_400_000).toISOString();
    return { moved: false as const, level: view.level, tryAgainOn: until };
  }
  const { error } = await admin.from("profiles").update({ kidda_level: scoredLevel }).eq("id", userId);
  if (error) throw error;
  await writeHistory(admin, {
    userId,
    fromLevel: view.level,
    toLevel: scoredLevel,
    source: "retake",
    changedBy: userId,
  });
  let podName = view.pod?.name ?? "Your pod";
  if (bandChanged(view.level, scoredLevel)) {
    const pod = await assignMemberPod(admin, userId);
    if ("name" in pod && pod.name) podName = pod.name;
  }
  return { moved: true as const, level: scoredLevel, podName };
}

function retakeWouldMove(current: number, scored: number) {
  return scored > current;
}

export async function setMemberLevel(admin: SupabaseClient, actorId: string, userId: string, toLevel: number, reason: string) {
  if (!reason.trim()) return { error: "A reason is required." };
  if (toLevel < 0 || toLevel > 9) return { error: "Level must be from 0 to 9." };
  const { data: profile, error } = await admin.from("profiles").select("kidda_level").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!profile) return { error: "Member not found." };
  const fromLevel = (profile.kidda_level as number | null) ?? null;
  if (fromLevel === toLevel) return { error: "That is already their level." };
  const { error: updateError } = await admin.from("profiles").update({ kidda_level: toLevel }).eq("id", userId);
  if (updateError) throw updateError;
  await writeHistory(admin, { userId, fromLevel, toLevel, source: "admin", changedBy: actorId, reason });
  if (fromLevel != null && bandChanged(fromLevel, toLevel)) {
    await assignMemberPod(admin, userId);
  }
  return { ok: true as const };
}
