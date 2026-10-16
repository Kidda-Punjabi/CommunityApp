import "server-only";

import type { NotificationType } from "@/lib/friends/constants";
import { planNotificationInserts } from "@/lib/notifications/route-notification";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function insertRoutedNotifications(
  supabase: SupabaseClient,
  input: {
    type: NotificationType;
    userId?: string | null;
    kidProfileId?: string | null;
    parentUserId?: string | null;
    actorUserId?: string | null;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  const rows = planNotificationInserts(input);
  if (rows.length === 0) return;

  const { error } = await supabase.from("notifications").insert(
    rows.map((row) => ({
      user_id: row.user_id,
      kid_profile_id: row.kid_profile_id,
      type: input.type,
      actor_user_id: input.actorUserId ?? null,
      payload: input.payload ?? {},
    }))
  );

  if (error) throw error;

  const userIds = rows.map((row) => row.user_id).filter((id): id is string => Boolean(id));
  const kidProfileIds = rows
    .map((row) => row.kid_profile_id)
    .filter((id): id is string => Boolean(id));
  void import("@/lib/push/from-notification")
    .then((mod) => mod.pushInsertedNotifications({ userIds, kidProfileIds }))
    .catch((pushError) => {
      console.error("[push] notification hook", pushError);
    });
}
