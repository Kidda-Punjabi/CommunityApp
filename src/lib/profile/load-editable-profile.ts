import type { SupabaseClient } from "@supabase/supabase-js";

export type EditableProfile = {
  full_name: string | null;
  preferred_name: string | null;
  avatar_url: string | null;
};

/** Loads profile fields for edit/display, tolerating a missing preferred_name column. */
export async function loadEditableProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<EditableProfile | null> {
  const withPreferred = await supabase
    .from("profiles")
    .select("full_name, preferred_name, avatar_url")
    .eq("id", userId)
    .single();

  if (!withPreferred.error) {
    return withPreferred.data;
  }

  const message = withPreferred.error.message.toLowerCase();
  if (!message.includes("preferred_name")) {
    return null;
  }

  const basic = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", userId)
    .single();

  if (basic.error || !basic.data) {
    return null;
  }

  return {
    full_name: basic.data.full_name,
    preferred_name: null,
    avatar_url: basic.data.avatar_url,
  };
}
