"use server";

import { resolveCourseActor } from "@/lib/kids/course-actor";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult = { error?: string; success?: string };

export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard/learn");
  revalidatePath("/dashboard/home");
  return { success: "Marked as read." };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const actor = await resolveCourseActor(supabase, user.id);
  const { error } = await supabase.rpc("mark_all_notifications_read", {
    p_kid_profile_id: actor.kind === "kid" ? actor.kidProfileId : null,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard/learn");
  revalidatePath("/dashboard/home");
  return { success: "All caught up!" };
}

export async function sendKudos(notificationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_kudos", {
    p_notification_id: notificationId,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard/learn");
  revalidatePath("/dashboard/home");
  return { success: "Kudos sent!" };
}

export async function updateNotificationSettings(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_notification_settings", {
    p_friend_requests: formData.get("friend_requests") === "on",
    p_friend_level_ups: formData.get("friend_level_ups") === "on",
    p_kudos: formData.get("kudos") === "on",
    p_announcements: formData.get("announcements") === "on",
    p_game_challenges: formData.get("game_challenges") === "on",
    p_homework_reviews: formData.get("homework_reviews") === "on",
    p_lesson_scheduling: formData.get("lesson_scheduling") === "on",
    p_class_reminders: formData.get("class_reminders") === "on",
    p_homework_due: formData.get("homework_due") === "on",
    p_community_sessions: formData.get("community_sessions") === "on",
    p_forum_activity: formData.get("forum_activity") === "on",
    p_streaks: formData.get("streaks") === "on",
    p_weekly_recap: formData.get("weekly_recap") === "on",
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/profile/notifications");
  return { success: "Notification settings saved." };
}

export async function publishAnnouncement(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const audience = String(formData.get("audience") ?? "all");
  const recipientIds = formData
    .getAll("recipient_ids")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (!title || !body) return { error: "Title and message are required." };

  if (audience === "selected" && recipientIds.length === 0) {
    return { error: "Select at least one member, or choose all members." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_publish_announcement", {
    p_title: title,
    p_body: body,
    p_recipient_user_ids: audience === "selected" ? recipientIds : null,
    p_send_push: formData.get("send_push") === "on",
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/notifications");
  revalidatePath("/admin/content");

  const successMessage =
    audience === "selected"
      ? `Announcement sent to ${recipientIds.length} member${recipientIds.length === 1 ? "" : "s"}.`
      : "Announcement sent to all members.";

  return { success: successMessage };
}
