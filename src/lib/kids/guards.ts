import { redirect } from "next/navigation";
import { loadKidSession } from "@/lib/kids/session";
import { kidHomeHref } from "@/lib/kids/load-kid-content";
import { createClient } from "@/lib/supabase/server";

export async function requireNoActiveKidProfile(redirectTo?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const session = await loadKidSession(user.id);
  if (session.activeKidProfile) {
    redirect(
      redirectTo ?? kidHomeHref(session.activeKidProfile.age_tier)
    );
  }

  return { user, supabase };
}

export async function requireForumAccessAllowed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const session = await loadKidSession(user.id);
  if (session.activeKidProfile) {
    redirect(kidHomeHref(session.activeKidProfile.age_tier));
  }

  return { user, supabase };
}
