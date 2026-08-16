import { ParentKidsProgressDetail } from "@/components/kids/parent-kids-progress-detail";
import { BackLink } from "@/components/navigation/back-link";
import { requireNoActiveKidProfile } from "@/lib/kids/guards";
import { loadParentKidsCourseProgress } from "@/lib/kids/load-parent-course-progress";
import type { KidProfile } from "@/lib/kids/types";
import { ui } from "@/lib/ui/styles";
import { notFound } from "next/navigation";

type KidsProgressDetailPageProps = {
  params: Promise<{ kidProfileId: string }>;
};

export default async function KidsProgressDetailPage({
  params,
}: KidsProgressDetailPageProps) {
  const { kidProfileId } = await params;
  const { user, supabase } = await requireNoActiveKidProfile();

  const { data: kid } = await supabase
    .from("kid_profiles")
    .select("*")
    .eq("id", kidProfileId)
    .eq("parent_user_id", user.id)
    .maybeSingle();

  if (!kid) notFound();

  const [progress] = await loadParentKidsCourseProgress(supabase, user.id, [
    kid as KidProfile,
  ]);

  if (!progress) notFound();

  return (
    <div className={ui.page}>
      <BackLink href="/dashboard/learn/kids-progress">← All children</BackLink>
      <div className="mt-4">
        <ParentKidsProgressDetail progress={progress} />
      </div>
    </div>
  );
}
