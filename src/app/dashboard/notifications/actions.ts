"use server";

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
  const { error } = await supabase.rpc("mark_all_notifications_read");

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
