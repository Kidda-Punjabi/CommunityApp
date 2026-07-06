import { cookies } from "next/headers";
import { KID_PROFILE_COOKIE } from "@/lib/kids/constants";
import type { KidProfile, KidSession } from "@/lib/kids/types";
import { createClient } from "@/lib/supabase/server";

export async function getActiveKidProfileIdFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(KID_PROFILE_COOKIE)?.value?.trim();
  return value || null;
}

export async function loadKidSession(userId: string): Promise<KidSession> {
  const supabase = await createClient();
  const kidProfileId = await getActiveKidProfileIdFromCookie();

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("kids_pin_hash")
    .eq("id", userId)
    .maybeSingle();

  let activeKidProfile: KidProfile | null = null;

  if (kidProfileId) {
    const { data } = await supabase
      .from("kid_profiles")
      .select("*")
      .eq("id", kidProfileId)
      .eq("parent_user_id", userId)
      .maybeSingle();

    if (data) {
      activeKidProfile = data as KidProfile;
    }
  }

  return {
    activeKidProfile,
    hasPin: Boolean(profileRow?.kids_pin_hash),
  };
}

export async function syncKidSessionContext(
  userId: string,
  activeKidProfileId: string | null
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("kid_session_context").upsert({
    user_id: userId,
    active_kid_profile_id: activeKidProfileId,
    updated_at: new Date().toISOString(),
  });
}

export function kidProfileCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 30) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
