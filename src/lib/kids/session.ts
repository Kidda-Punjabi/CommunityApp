import { cookies } from "next/headers";
import {
  KID_PROFILE_COOKIE,
  KIDS_PIN_UNLOCKED_COOKIE,
  WHO_IS_LEARNING_COOKIE,
} from "@/lib/kids/constants";
import type { KidProfile, KidSession } from "@/lib/kids/types";
import { createClient } from "@/lib/supabase/server";

export async function getActiveKidProfileIdFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(KID_PROFILE_COOKIE)?.value?.trim();
  return value || null;
}

export async function isKidsPinUnlocked(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(KIDS_PIN_UNLOCKED_COOKIE)?.value === "1";
}

export async function hasPickedWhoThisSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(WHO_IS_LEARNING_COOKIE)?.value === "1";
}

export async function loadKidSession(userId: string): Promise<KidSession> {
  const supabase = await createClient();

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("kids_pin_hash")
    .eq("id", userId)
    .maybeSingle();

  const { data: context } = await supabase
    .from("kid_session_context")
    .select("active_kid_profile_id")
    .eq("user_id", userId)
    .maybeSingle();

  let kidProfileId =
    (context?.active_kid_profile_id as string | null | undefined) ??
    (await getActiveKidProfileIdFromCookie());

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
      if (context?.active_kid_profile_id !== kidProfileId) {
        await syncKidSessionContext(userId, kidProfileId);
      }
    } else {
      kidProfileId = null;
      await syncKidSessionContext(userId, null);
    }
  }

  const { count: kidCount } = await supabase
    .from("kid_profiles")
    .select("id", { count: "exact", head: true })
    .eq("parent_user_id", userId);

  return {
    activeKidProfile,
    hasPin: Boolean(profileRow?.kids_pin_hash),
    pinUnlocked: await isKidsPinUnlocked(),
    hasKidProfiles: (kidCount ?? 0) > 0,
    pickedWhoThisSession: await hasPickedWhoThisSession(),
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

/** Session-scoped: cleared when the browser session ends. */
export function kidsPinUnlockedCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export function markWhoIsLearningPicked(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  cookieStore.set(WHO_IS_LEARNING_COOKIE, "1", kidsPinUnlockedCookieOptions());
}
