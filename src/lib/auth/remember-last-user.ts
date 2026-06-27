import {
  lastUserCookieOptions,
  lastUserFromAuthMetadata,
  LAST_USER_COOKIE,
  type LastUserPayload,
  serializeLastUser,
} from "@/lib/auth/last-user";
import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export async function buildLastUserPayload(
  supabase: SupabaseClient
): Promise<LastUserPayload | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, preferred_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return {
    email: user.email,
    displayName: getDisplayName(profile) ?? user.email.split("@")[0],
    avatarUrl: profile?.avatar_url ?? null,
  };
}

export async function persistLastUser(supabase: SupabaseClient): Promise<void> {
  const payload = await buildLastUserPayload(supabase);
  if (!payload) return;

  const cookieStore = await cookies();
  cookieStore.set(LAST_USER_COOKIE, serializeLastUser(payload), lastUserCookieOptions());
}

export function setLastUserOnResponse(
  response: NextResponse,
  payload: LastUserPayload
): void {
  response.cookies.set(LAST_USER_COOKIE, serializeLastUser(payload), lastUserCookieOptions());
}

export function setLastUserFromAuthUserOnResponse(
  response: NextResponse,
  user: Parameters<typeof lastUserFromAuthMetadata>[0]
): void {
  const payload = lastUserFromAuthMetadata(user);
  if (payload) setLastUserOnResponse(response, payload);
}

export async function clearLastUserCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(LAST_USER_COOKIE);
}
