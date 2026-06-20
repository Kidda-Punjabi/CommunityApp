"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult = { error?: string; success?: string };

export async function markNotificationRead(notificationId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_notification_read", { p_notification_id: notificationId });
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard/home");
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_all_notifications_read");

  if (error) return { error: error.message };

  revalidatePath("/dashboard/notifications");
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

  if (!title || !body) return { error: "Title and message are required." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_publish_announcement", {
    p_title: title,
    p_body: body,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/notifications");
  return { success: "Announcement sent to all members." };
}
