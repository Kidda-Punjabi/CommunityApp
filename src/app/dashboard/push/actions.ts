"use server";

import { createClient } from "@/lib/supabase/server";

export async function registerDevicePushToken(input: {
  token: string;
  timezone: string;
  appVersion: string;
  platform?: "ios" | "android";
}): Promise<void> {
  const token = input.token.trim();
  if (!token) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_device_push_token", {
    p_token: token,
    p_timezone: input.timezone,
    p_app_version: input.appVersion,
    p_platform: input.platform === "android" ? "android" : "ios",
  });
  if (error) console.error("[push] register", error.message);
}

export async function touchDevicePushToken(token: string): Promise<void> {
  if (!token.trim()) return;
  const supabase = await createClient();
  await supabase.rpc("touch_device_push_token", { p_token: token.trim() });
}

export async function deleteDevicePushToken(token: string): Promise<void> {
  if (!token.trim()) return;
  const supabase = await createClient();
  await supabase.rpc("delete_my_device_push_token", { p_token: token.trim() });
}

export async function nextClassEndsAt(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("tutor_scheduled_sessions")
    .select("ends_at, starts_at")
    .eq("student_id", user.id)
    .eq("status", "scheduled")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.ends_at as string | null) ?? (data?.starts_at as string | null) ?? null;
}

export async function unreadPushBadgeCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);
  return count ?? 0;
}
