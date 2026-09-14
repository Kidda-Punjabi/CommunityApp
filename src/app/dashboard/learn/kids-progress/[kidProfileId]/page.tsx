import { ParentKidsProgressDetail } from "@/components/kids/parent-kids-progress-detail";
import { BackLink } from "@/components/navigation/back-link";
import { kidHomeHref } from "@/lib/kids/load-kid-content";
import { loadParentKidsCourseProgress } from "@/lib/kids/load-parent-course-progress";
import { activateKidProfileSession, loadKidSession } from "@/lib/kids/session";
import type { KidProfile } from "@/lib/kids/types";
import { kidsCourseLearnPath } from "@/lib/learning/kids-courses";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type KidsProgressDetailPageProps = {
  params: Promise<{ kidProfileId: string }>;
};

export default async function KidsProgressDetailPage({
  params,
}: KidsProgressDetailPageProps) {
  const { kidProfileId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const kidSession = await loadKidSession(user.id);
  if (
    kidSession.activeKidProfile &&
    kidSession.activeKidProfile.id !== kidProfileId
  ) {
    redirect(kidHomeHref(kidSession.activeKidProfile.age_tier));
  }

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

  const courseId = progress.courses[0]?.courseId ?? null;
  if (courseId) {
    if (!kidSession.activeKidProfile) {
      await activateKidProfileSession(user.id, kidProfileId);
    }
    redirect(kidsCourseLearnPath(courseId));
  }

  return (
    <div className={ui.page}>
      <BackLink href="/dashboard/learn/kids-progress">← All children</BackLink>
      <div className="mt-4">
        <ParentKidsProgressDetail progress={progress} />
      </div>
    </div>
  );
}
