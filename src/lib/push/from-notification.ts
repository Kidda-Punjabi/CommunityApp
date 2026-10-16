import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { getDisplayName } from "@/lib/profile/display-name";
import { sendPush } from "@/lib/push/send";

const IN_APP_ONLY = new Set([
  "kudos",
  "friend_level_up",
  "student_discount_approved",
  "student_discount_rejected",
  "cohort_switch_requested",
  "cohort_new_student",
  "lesson_reschedule_requested",
  "lesson_reschedule_resolved",
  "tutor_cover_assigned",
]);

const PUSH_TYPE: Record<string, string> = {
  homework_reviewed: "H4",
  cohort_switch_resolved: "R1",
  cohort_placement_pending: "R2",
  certificate_issued: "R3",
  friend_request: "G1",
  friend_request_accepted: "G2",
  friend_game_challenge: "G3",
  friend_game_challenge_result: "G4",
  announcement: "A1",
};

type NotificationRow = {
  id: string;
  user_id: string | null;
  kid_profile_id: string | null;
  type: string;
  actor_user_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

function text(payload: Record<string, unknown> | null, key: string): string {
  const value = payload?.[key];
  return typeof value === "string" ? value : "";
}

export function contentForNotification(
  row: NotificationRow,
  actorName: string
): { type: string; title: string; body: string; url: string } | null {
  if (IN_APP_ONLY.has(row.type)) return null;
  const type = PUSH_TYPE[row.type];
  if (!type) return null;
  const payload = row.payload;
  const name = actorName || "Someone";

  switch (type) {
    case "H4": {
      const lesson = text(payload, "lesson_title") || "your lesson";
      const lessonId = text(payload, "lesson_id");
      return {
        type,
        title: `${name} reviewed your homework`,
        body: `See their feedback on ${lesson}.`,
        url: lessonId ? `/dashboard/learn/homework/${lessonId}` : "/dashboard/learn",
      };
    }
    case "R1":
      return {
        type,
        title: "Your class change is confirmed",
        body: text(payload, "moved_summary") || "You're now in your new class.",
        url: text(payload, "session_id")
          ? `/dashboard/schedule/${text(payload, "session_id")}`
          : "/dashboard/schedule",
      };
    case "R2":
      return {
        type,
        title: "We're finding your class",
        body: "We'll let you know as soon as your cohort is confirmed.",
        url: "/dashboard/schedule",
      };
    case "R3":
      return {
        type,
        title: "You've earned a certificate",
        body: `Congratulations on finishing ${text(payload, "course") || text(payload, "level") || "your course"}!`,
        url: "/dashboard/learn/certificates",
      };
    case "G1":
      return {
        type,
        title: `${name} sent you a friend request`,
        body: "Tap to accept.",
        url: "/dashboard/friends",
      };
    case "G2":
      return {
        type,
        title: `${name} accepted your request`,
        body: "Challenge them to a game.",
        url: "/dashboard/friends",
      };
    case "G3":
      return {
        type,
        title: `${name} challenged you`,
        body: "Think you can beat them?",
        url: text(payload, "challenge_id")
          ? `/dashboard/challenges/${text(payload, "challenge_id")}/play`
          : "/dashboard/friends",
      };
    case "G4": {
      const winnerId = text(payload, "winner_id");
      const outcome =
        payload?.is_tie === true ? "tied" : winnerId && winnerId === row.user_id ? "won" : "lost";
      return {
        type,
        title: "Challenge result",
        body: `You ${outcome} against ${name}.`,
        url: text(payload, "challenge_id")
          ? `/dashboard/challenges/${text(payload, "challenge_id")}`
          : "/dashboard/friends",
      };
    }
    case "A1":
      if (payload?.homework_due === true) return null;
      return {
        type,
        title: text(payload, "title") || "Announcement",
        body: text(payload, "body") || "Open Kidda to read it.",
        url: "/dashboard/notifications",
      };
    default:
      return null;
  }
}

async function deliverRows(rows: NotificationRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const admin = createServiceRoleClient();
  const actorIds = [...new Set(rows.map((row) => row.actor_user_id).filter(Boolean))] as string[];
  const kidIds = [...new Set(rows.map((row) => row.kid_profile_id).filter(Boolean))] as string[];
  const announcementIds = [
    ...new Set(
      rows
        .filter((row) => row.type === "announcement")
        .map((row) => text(row.payload, "announcement_id"))
        .filter(Boolean)
    ),
  ];

  const [{ data: actors }, { data: kids }, { data: announcements }] = await Promise.all([
    actorIds.length
      ? admin.from("profiles").select("id, full_name, preferred_name").in("id", actorIds)
      : Promise.resolve({ data: [] }),
    kidIds.length
      ? admin.from("kid_profiles").select("id, name, parent_user_id").in("id", kidIds)
      : Promise.resolve({ data: [] }),
    announcementIds.length
      ? admin.from("announcements").select("id, send_push").in("id", announcementIds)
      : Promise.resolve({ data: [] }),
  ]);

  const actorNames = new Map(
    (actors ?? []).map((actor) => [actor.id as string, getDisplayName(actor) ?? "Someone"])
  );
  const kidById = new Map((kids ?? []).map((kid) => [kid.id as string, kid]));
  const pushAnnouncements = new Set(
    (announcements ?? []).filter((row) => row.send_push === true).map((row) => row.id as string)
  );

  const parentRows = rows.filter((row) => row.user_id);
  const kidRows = rows.filter((row) => !row.user_id && row.kid_profile_id);
  let sent = 0;

  for (const row of parentRows) {
    if (row.type === "announcement") {
      const announcementId = text(row.payload, "announcement_id");
      if (!announcementId || !pushAnnouncements.has(announcementId)) continue;
    }
    const match = kidRows.find((kidRow) => {
      if (kidRow.type !== row.type) return false;
      const kid = kidById.get(kidRow.kid_profile_id as string);
      if (!kid || kid.parent_user_id !== row.user_id) return false;
      const lesson = text(row.payload, "lesson_id");
      if (lesson && lesson !== text(kidRow.payload, "lesson_id")) return false;
      return Math.abs(new Date(kidRow.created_at).getTime() - new Date(row.created_at).getTime()) < 120_000;
    });
    const content = contentForNotification(row, actorNames.get(row.actor_user_id ?? "") ?? "Someone");
    if (!content) continue;
    const result = await sendPush({
      userId: row.user_id as string,
      kidProfileId: (match?.kid_profile_id as string | null) ?? null,
      type: content.type,
      refKey: row.id,
      title: content.title,
      body: content.body,
      url: content.url,
    });
    if (result === "sent") sent += 1;
  }
  return sent;
}

export async function sweepRecentNotificationPushes(now = new Date()): Promise<number> {
  const admin = createServiceRoleClient();
  const since = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("notifications")
    .select("id, user_id, kid_profile_id, type, actor_user_id, payload, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("[push] notification sweep", error.message);
    return 0;
  }
  return deliverRows((data ?? []) as NotificationRow[]);
}

export async function pushInsertedNotifications(input: {
  userIds: string[];
  kidProfileIds: string[];
}): Promise<void> {
  const userIds = input.userIds.filter(Boolean);
  const kidProfileIds = input.kidProfileIds.filter(Boolean);
  if (userIds.length === 0 && kidProfileIds.length === 0) return;
  const admin = createServiceRoleClient();
  const since = new Date(Date.now() - 60_000).toISOString();
  const queries = [];
  if (userIds.length > 0) {
    queries.push(
      admin
        .from("notifications")
        .select("id, user_id, kid_profile_id, type, actor_user_id, payload, created_at")
        .in("user_id", userIds)
        .gte("created_at", since)
        .limit(20)
    );
  }
  if (kidProfileIds.length > 0) {
    queries.push(
      admin
        .from("notifications")
        .select("id, user_id, kid_profile_id, type, actor_user_id, payload, created_at")
        .in("kid_profile_id", kidProfileIds)
        .gte("created_at", since)
        .limit(20)
    );
  }
  const results = await Promise.all(queries);
  const rows = results.flatMap((result) => (result.data ?? []) as NotificationRow[]);
  await deliverRows(rows);
}
