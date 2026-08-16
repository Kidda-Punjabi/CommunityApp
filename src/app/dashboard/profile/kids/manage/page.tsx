import Link from "next/link";
import { ParentKidsDashboard } from "@/components/kids/parent-kids-dashboard";
import { requireNoActiveKidProfile } from "@/lib/kids/guards";
import { loadParentKidsCourseProgress } from "@/lib/kids/load-parent-course-progress";
import type { KidProfile } from "@/lib/kids/types";
import { ui } from "@/lib/ui/styles";

export default async function ManageKidsPage() {
  const { user, supabase } = await requireNoActiveKidProfile();

  const { data: kidProfiles } = await supabase
    .from("kid_profiles")
    .select("*")
    .eq("parent_user_id", user.id)
    .order("created_at", { ascending: true });

  const summaries = await Promise.all(
    (kidProfiles ?? []).map(async (kid) => {
      const [{ count: activitiesCompleted }, { count: stickersEarned }, { data: lastActivity }] =
        await Promise.all([
          supabase
            .from("kid_activity_log")
            .select("*", { count: "exact", head: true })
            .eq("kid_profile_id", kid.id),
          supabase
            .from("kid_stickers")
            .select("*", { count: "exact", head: true })
            .eq("kid_profile_id", kid.id),
          supabase
            .from("kid_activity_log")
            .select("completed_at")
            .eq("kid_profile_id", kid.id)
            .order("completed_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

      return {
        profile: kid,
        activitiesCompleted: activitiesCompleted ?? 0,
        stickersEarned: stickersEarned ?? 0,
        lastActiveAt: lastActivity?.completed_at ?? null,
      };
    })
  );

  const courseProgress = await loadParentKidsCourseProgress(
    supabase,
    user.id,
    (kidProfiles ?? []) as KidProfile[]
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("kids_pin_hash")
    .eq("id", user.id)
    .single();

  return (
    <div className={ui.page}>
      <Link
        href="/dashboard/profile"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to profile
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-zinc-900">Manage kid profiles</h1>
      <ParentKidsDashboard
        summaries={summaries}
        courseProgress={courseProgress}
        hasPin={Boolean(profile?.kids_pin_hash)}
      />
    </div>
  );
}
