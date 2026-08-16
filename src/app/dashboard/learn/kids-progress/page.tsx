import { ParentKidsProgressList } from "@/components/kids/parent-kids-progress-list";
import { BackLink } from "@/components/navigation/back-link";
import { requireNoActiveKidProfile } from "@/lib/kids/guards";
import { loadParentKidsCourseProgress } from "@/lib/kids/load-parent-course-progress";
import type { KidProfile } from "@/lib/kids/types";
import { ui } from "@/lib/ui/styles";

export default async function KidsProgressPage() {
  const { user, supabase } = await requireNoActiveKidProfile();

  const { data: kidProfiles } = await supabase
    .from("kid_profiles")
    .select("*")
    .eq("parent_user_id", user.id)
    .order("created_at", { ascending: true });

  const rows = await loadParentKidsCourseProgress(
    supabase,
    user.id,
    (kidProfiles ?? []) as KidProfile[]
  );

  return (
    <div className={ui.page}>
      <BackLink href="/dashboard/learn">← Back to Learn</BackLink>
      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">How your kids are doing</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Homework, attendance, and tutor notes for each child.
        </p>
      </div>
      <ParentKidsProgressList rows={rows} />
    </div>
  );
}
