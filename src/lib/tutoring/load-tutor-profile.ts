import type { SupabaseClient } from "@supabase/supabase-js";

export type TutorEditableProfile = {
  full_name: string | null;
  preferred_name: string | null;
  avatar_url: string | null;
  tutor_bio: string | null;
};

/** Loads tutor profile fields for edit/display, tolerating missing tutor_bio column. */
export async function loadTutorProfileForEdit(
  supabase: SupabaseClient,
  userId: string
): Promise<TutorEditableProfile | null> {
  const withBio = await supabase
    .from("profiles")
    .select("full_name, preferred_name, avatar_url, tutor_bio")
    .eq("id", userId)
    .single();

  if (!withBio.error) {
    return {
      full_name: withBio.data.full_name,
      preferred_name: withBio.data.preferred_name,
      avatar_url: withBio.data.avatar_url,
      tutor_bio: withBio.data.tutor_bio ?? null,
    };
  }

  const message = withBio.error.message.toLowerCase();
  if (message.includes("tutor_bio")) {
    const basic = await supabase
      .from("profiles")
      .select("full_name, preferred_name, avatar_url")
      .eq("id", userId)
      .single();

    if (basic.error || !basic.data) {
      return null;
    }

    return {
      full_name: basic.data.full_name,
      preferred_name: basic.data.preferred_name,
      avatar_url: basic.data.avatar_url,
      tutor_bio: null,
    };
  }

  if (message.includes("preferred_name")) {
    const basic = await supabase
      .from("profiles")
      .select("full_name, avatar_url, tutor_bio")
      .eq("id", userId)
      .single();

    if (basic.error || !basic.data) {
      return null;
    }

    return {
      full_name: basic.data.full_name,
      preferred_name: null,
      avatar_url: basic.data.avatar_url,
      tutor_bio: (basic.data as { tutor_bio?: string | null }).tutor_bio ?? null,
    };
  }

  return null;
}
