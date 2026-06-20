import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationType } from "@/lib/friends/constants";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  createdAt: string;
  readAt: string | null;
  actorUserId: string | null;
  actorDisplayName: string | null;
  actorAvatarUrl: string | null;
  payload: Record<string, unknown>;
  kudosSent: boolean;
};

export type NotificationSettings = {
  friendRequests: boolean;
  friendLevelUps: boolean;
  kudos: boolean;
  announcements: boolean;
  gameChallenges: boolean;
};

type ActorProfile = {
  full_name: string | null;
  preferred_name: string | null;
  avatar_url: string | null;
};

type NotificationRow = {
  id: string;
  type: NotificationType;
  created_at: string;
  read_at: string | null;
  actor_user_id: string | null;
  payload: Record<string, unknown> | null;
  actor: ActorProfile | ActorProfile[] | null;
};

function unwrapActor(row: NotificationRow): ActorProfile | null {
  if (!row.actor) return null;
  return Array.isArray(row.actor) ? (row.actor[0] ?? null) : row.actor;
}

function isMissingNotificationsSchema(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("notifications") || lower.includes("notification_settings");
}

export async function loadNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit = 50
): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(
      `
      id,
      type,
      created_at,
      read_at,
      actor_user_id,
      payload,
      actor:actor_user_id (full_name, preferred_name, avatar_url)
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingNotificationsSchema(error.message)) return [];
    throw error;
  }

  const rows = (data ?? []) as NotificationRow[];
  const levelUpIds = rows
    .filter((row) => row.type === "friend_level_up")
    .map((row) => row.id);

  let kudosSent = new Set<string>();
  if (levelUpIds.length > 0) {
    const { data: kudosRows } = await supabase
      .from("notification_kudos")
      .select("notification_id")
      .eq("from_user_id", userId)
      .in("notification_id", levelUpIds);

    kudosSent = new Set((kudosRows ?? []).map((row) => row.notification_id as string));
  }

  return rows.map((row) => {
    const actor = unwrapActor(row);
    return {
      id: row.id,
      type: row.type,
      createdAt: row.created_at,
      readAt: row.read_at,
      actorUserId: row.actor_user_id,
      actorDisplayName: getDisplayName(actor),
      actorAvatarUrl: actor?.avatar_url ?? null,
      payload: row.payload ?? {},
      kudosSent: kudosSent.has(row.id),
    };
  });
}

export async function loadUnreadNotificationCount(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) {
    if (isMissingNotificationsSchema(error.message)) return 0;
    return 0;
  }

  return count ?? 0;
}

export async function loadNotificationSettings(
  supabase: SupabaseClient
): Promise<NotificationSettings | null> {
  const { data, error } = await supabase.rpc("ensure_my_notification_settings");

  if (error) {
    if (isMissingNotificationsSchema(error.message)) return null;
    throw error;
  }

  const row = data as {
    friend_requests: boolean;
    friend_level_ups: boolean;
    kudos: boolean;
    announcements: boolean;
    game_challenges: boolean;
  };

  return {
    friendRequests: row.friend_requests,
    friendLevelUps: row.friend_level_ups,
    kudos: row.kudos,
    announcements: row.announcements,
    gameChallenges: row.game_challenges ?? true,
  };
}

export function notificationSummary(item: NotificationItem): string {
  const name = item.actorDisplayName ?? "Someone";

  switch (item.type) {
    case "friend_request":
      return `${name} sent you a friend request`;
    case "friend_request_accepted":
      return `${name} accepted your friend request`;
    case "friend_level_up": {
      const level = item.payload.new_level;
      return `${name} reached Level ${level ?? "?"}`;
    }
    case "kudos": {
      const level = item.payload.level;
      return `${name} sent you kudos${level ? ` for reaching Level ${level}` : ""}!`;
    }
    case "announcement":
      return String(item.payload.title ?? "New announcement from Kidda");
    case "friend_game_challenge": {
      const gameType = String(item.payload.game_type ?? "game").replace(/_/g, " ");
      const score = item.payload.challenger_score;
      return `${name} challenged you to ${gameType}${score != null ? ` (score: ${score})` : ""}`;
    }
    case "friend_game_challenge_result": {
      if (item.payload.is_tie) {
        return `Your ${String(item.payload.game_type ?? "game").replace(/_/g, " ")} challenge ended in a tie`;
      }
      const winnerId = item.payload.winner_id;
      if (typeof winnerId === "string" && winnerId === item.actorUserId) {
        return `${name} won your challenge!`;
      }
      return `Challenge result is in — see who won`;
    }
    default:
      return "New notification";
  }
}
