import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { loadOnboardingProfile } from "@/lib/progression/load-user-progression";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthSession = {
  supabase: SupabaseClient;
  user: User;
};

/** Dedupes auth + common layout fetches within a single navigation request. */
export const getCachedAuthSession = cache(async (): Promise<AuthSession | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return { supabase, user };
});

export const getCachedCourseAccess = cache(async (supabase: SupabaseClient, user: User) => {
  return getCourseAccessContext(supabase, user);
});

export const getCachedOnboardingProfile = cache(async (supabase: SupabaseClient, userId: string) => {
  return loadOnboardingProfile(supabase, userId);
});
