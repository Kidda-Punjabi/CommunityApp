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

/** Community / social surfaces are unreachable while a kid profile is active. */
export async function requireNoKidCommunityAccess() {
  return requireNoActiveKidProfile();
}

export async function requireForumAccessAllowed() {
  return requireNoActiveKidProfile();
}

/** For server actions / APIs that cannot redirect. */
export async function rejectIfKidCommunityBlocked(): Promise<
  | { blocked: true; error: string }
  | { blocked: false; user: { id: string }; supabase: Awaited<ReturnType<typeof createClient>> }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { blocked: true, error: "You must be signed in." };

  const session = await loadKidSession(user.id);
  if (session.activeKidProfile) {
    return { blocked: true, error: "Community is not available on a kid profile." };
  }

  return { blocked: false, user, supabase };
}
