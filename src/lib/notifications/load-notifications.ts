import { getDisplayName } from "@/lib/profile/display-name";
import type { FriendRequestStatus, NotificationType } from "@/lib/friends/constants";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Admin workflow alerts — use Admin Home / admin pages, not learner notifications. */
export const ADMIN_ONLY_NOTIFICATION_TYPES = new Set<NotificationType>([
  "cohort_switch_requested",
]);

export function isAdminOnlyNotificationType(type: NotificationType): boolean {
  return ADMIN_ONLY_NOTIFICATION_TYPES.has(type);
}

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
  /** Set for friend_request notifications — controls whether action buttons show. */
  friendRequestStatus?: FriendRequestStatus | null;
};

export type NotificationSettings = {
  friendRequests: boolean;
  friendLevelUps: boolean;
  kudos: boolean;
  announcements: boolean;
  gameChallenges: boolean;
  homeworkReviews: boolean;
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

  const rows = ((data ?? []) as NotificationRow[]).filter(
    (row) => !isAdminOnlyNotificationType(row.type)
  );
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

  const friendRequestIds = rows
    .filter((row) => row.type === "friend_request")
    .map((row) => row.payload?.request_id)
    .filter((id): id is string => typeof id === "string");

  const friendRequestStatusById = new Map<string, FriendRequestStatus>();
  if (friendRequestIds.length > 0) {
    const { data: requestRows } = await supabase
      .from("friend_requests")
      .select("id, status")
      .in("id", friendRequestIds);

    for (const row of requestRows ?? []) {
      friendRequestStatusById.set(row.id as string, row.status as FriendRequestStatus);
    }
  }

  return rows.map((row) => {
    const actor = unwrapActor(row);
    const requestId =
      row.type === "friend_request" && typeof row.payload?.request_id === "string"
        ? row.payload.request_id
        : null;

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
      friendRequestStatus: requestId
        ? (friendRequestStatusById.get(requestId) ?? null)
        : undefined,
    };
  });
}

export async function loadUnreadNotificationCount(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  let query = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  for (const type of ADMIN_ONLY_NOTIFICATION_TYPES) {
    query = query.neq("type", type);
  }

  const { count, error } = await query;

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
    homework_reviews: boolean;
  };

  return {
    friendRequests: row.friend_requests,
    friendLevelUps: row.friend_level_ups,
    kudos: row.kudos,
    announcements: row.announcements,
    gameChallenges: row.game_challenges ?? true,
    homeworkReviews: row.homework_reviews ?? true,
  };
}

function formatNotificationWhen(iso: string | unknown): string | null {
  if (typeof iso !== "string" || !iso.trim()) return null;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
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
    case "announcement": {
      if (item.payload.homework_due === true) {
        const lessonTitle = String(item.payload.lesson_title ?? "your lesson");
        return `Homework reminder — ${lessonTitle}`;
      }
      return String(item.payload.title ?? "New announcement from Kidda");
    }
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
    case "homework_reviewed": {
      const lessonTitle = String(item.payload.lesson_title ?? "your lesson");
      if (item.payload.approved === true) {
        return `${name} approved your homework for ${lessonTitle}`;
      }
      return `${name} left feedback on your homework for ${lessonTitle}`;
    }
    case "student_discount_approved": {
      const requestLabel = String(item.payload.request_label ?? "your discount application");
      return `Your ${requestLabel} discount was approved`;
    }
    case "student_discount_rejected": {
      const requestLabel = String(item.payload.request_label ?? "your discount application");
      return `Your ${requestLabel} discount was not approved`;
    }
    case "cohort_placement_pending":
      return String(
        item.payload.message ??
          "Your payment went through — we’re confirming your cohort placement."
      );
    case "cohort_new_student": {
      const cohortName = item.payload.cohort_name;
      return `${name} joined cohort ${typeof cohortName === "string" ? cohortName : "group class"}`;
    }
    case "tutor_cover_assigned": {
      const title = String(item.payload.session_title ?? "a lesson");
      const deadline = formatNotificationWhen(item.payload.decision_deadline);
      return deadline
        ? `Cover assigned for ${title} — decline by ${deadline} if you can’t make it`
        : `Cover assigned for ${title}`;
    }
    case "cohort_switch_requested": {
      const studentName = String(item.payload.student_name ?? name);
      const toCohort = String(item.payload.to_cohort_name ?? "another cohort");
      const sessionTitle = String(item.payload.session_title ?? "a group lesson");
      const when = formatNotificationWhen(item.payload.starts_at);
      return when
        ? `${studentName} requested ${toCohort} for ${sessionTitle} (${when})`
        : `${studentName} requested ${toCohort} for ${sessionTitle}`;
    }
    case "cohort_switch_resolved": {
      const sessionTitle = String(item.payload.session_title ?? "your group lesson");
      const when = formatNotificationWhen(item.payload.starts_at);
      if (item.payload.status === "approved") {
        return when
          ? `Alternate cohort approved for ${sessionTitle} (${when})`
          : `Alternate cohort approved for ${sessionTitle}`;
      }
      return when
        ? `Alternate cohort request declined for ${sessionTitle} (${when})`
        : `Alternate cohort request declined for ${sessionTitle}`;
    }
    case "lesson_reschedule_requested": {
      const studentName = String(item.payload.student_name ?? name);
      const sessionTitle = String(item.payload.session_title ?? "a lesson");
      const when = formatNotificationWhen(item.payload.starts_at);
      return when
        ? `${studentName} requested to reschedule ${sessionTitle} (${when})`
        : `${studentName} requested to reschedule ${sessionTitle}`;
    }
    case "lesson_reschedule_resolved": {
      const sessionTitle = String(item.payload.session_title ?? "your lesson");
      const when = formatNotificationWhen(item.payload.starts_at);
      if (item.payload.status === "approved") {
        return when
          ? `Reschedule approved for ${sessionTitle} (${when})`
          : `Reschedule approved for ${sessionTitle}`;
      }
      return when
        ? `Reschedule declined for ${sessionTitle} (${when})`
        : `Reschedule declined for ${sessionTitle}`;
    }
    default: {
      const title = item.payload.title;
      if (typeof title === "string" && title.trim()) return title.trim();
      const message = item.payload.message;
      if (typeof message === "string" && message.trim()) return message.trim();
      return "New notification";
    }
  }
}
