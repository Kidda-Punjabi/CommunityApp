import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cooldownUntil,
  failedRetakeAt,
  xpTargetForLevel,
  type LevelHistoryRow,
} from "@/lib/community/level-progress";
import { sendPush, type SendPushResult } from "@/lib/push/send";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";

type Admin = SupabaseClient;

/**
 * P2: adult members whose XP at the current Kidda level first reaches the unlock
 * target. No-op when level/settings/XP are missing, during a retake cooldown, or
 * when a kid profile is active. Deduped once per level via refKey.
 */
export async function maybeSendLevelCheckReady(
  admin: Admin,
  userId: string,
  options?: { now?: Date; kidProfileId?: string | null }
): Promise<SendPushResult | "noop"> {
  const kidProfileId = options?.kidProfileId ?? null;
  if (kidProfileId) return "noop";

  const [{ data: profile }, { data: settings }, { data: history }] = await Promise.all([
    admin
      .from("profiles")
      .select("kidda_level, total_xp, xp_at_level_start")
      .eq("id", userId)
      .maybeSingle(),
    admin.from("community_level_settings").select("xp_to_unlock, retake_cooldown_days").eq("id", 1).maybeSingle(),
    admin
      .from("kidda_level_history")
      .select("from_level, to_level, source, created_at")
      .eq("user_id", userId)
      .order("created_at"),
  ]);

  if (profile?.kidda_level == null) return "noop";
  const level = Number(profile.kidda_level);
  const target = xpTargetForLevel(level, (settings?.xp_to_unlock as Record<string, number> | null) ?? null);
  if (target == null) return "noop";

  const earned = Math.max(0, Number(profile.total_xp ?? 0) - Number(profile.xp_at_level_start ?? 0));
  if (earned < target) return "noop";

  const rows: LevelHistoryRow[] = (history ?? []).map((row) => ({
    fromLevel: row.from_level as number | null,
    toLevel: row.to_level as number,
    source: row.source as LevelHistoryRow["source"],
    createdAt: row.created_at as string,
  }));
  const cooling = cooldownUntil(
    failedRetakeAt(rows),
    (settings?.retake_cooldown_days as number) ?? 28,
    options?.now ?? new Date()
  );
  if (cooling) return "noop";

  const nextLevel = level + 1;
  return sendPush({
    userId,
    kidProfileId: null,
    type: "P2",
    refKey: `${userId}:level:${level}`,
    title: `Your Level ${nextLevel} check is ready`,
    body: "You've earned enough XP. Take the check when you're ready.",
    url: "/dashboard/community/level",
    now: options?.now,
  });
}

/** After an XP grant: only fire when this award crosses the unlock threshold. */
export async function notifyLevelCheckAfterXpGrant(
  userId: string,
  input: {
    beforeTotalXp: number;
    beforeXpAtLevelStart: number;
    beforeLevel: number | null;
    granted: number;
  }
): Promise<void> {
  if (input.granted <= 0 || input.beforeLevel == null) return;
  try {
    const { client } = tryCreateServiceRoleClient();
    if (!client) return;
    const { data: settings } = await client
      .from("community_level_settings")
      .select("xp_to_unlock")
      .eq("id", 1)
      .maybeSingle();
    const target = xpTargetForLevel(
      input.beforeLevel,
      (settings?.xp_to_unlock as Record<string, number> | null) ?? null
    );
    if (target == null) return;
    const earnedBefore = Math.max(0, input.beforeTotalXp - input.beforeXpAtLevelStart);
    if (earnedBefore >= target || earnedBefore + input.granted < target) return;
    await maybeSendLevelCheckReady(client, userId);
  } catch (error) {
    console.error("Failed to send level-check push:", error);
  }
}
