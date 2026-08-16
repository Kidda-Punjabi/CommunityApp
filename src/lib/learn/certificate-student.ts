import "server-only";

import { resolveCourseActor } from "@/lib/kids/course-actor";
import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function loadCertificateStudentName(
  supabase: SupabaseClient,
  user: User
): Promise<string> {
  const actor = await resolveCourseActor(supabase, user.id);
  if (actor.kind === "kid") {
    const { data: kid } = await supabase
      .from("kid_profiles")
      .select("name")
      .eq("id", actor.kidProfileId)
      .maybeSingle();
    const kidName = kid?.name?.trim();
    if (kidName) return kidName;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, preferred_name")
    .eq("id", user.id)
    .maybeSingle();

  return getDisplayName(profile) ?? user.email?.split("@")[0] ?? "Student";
}
