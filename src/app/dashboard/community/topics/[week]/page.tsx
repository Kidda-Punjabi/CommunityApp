import { CommunityPageHeader } from "@/components/community/community-page-header";
import { memberHasCommunity } from "@/lib/community/load-home";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { COMMUNITY_COURSE_ID } from "@/lib/topics/constants";
import { ui } from "@/lib/ui/styles";

export default async function CommunityTopicWeekPage({ params }: { params: Promise<{ week: string }> }) {
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  if (!(await memberHasCommunity(admin, user.id))) return null;
  const week = Number((await params).week);
  const { data: lesson } = await admin
    .from("lessons")
    .select("title, presentation_url")
    .eq("course_id", COMMUNITY_COURSE_ID)
    .eq("lesson_number", week)
    .maybeSingle();

  return (
    <div className={`${ui.page} font-[family-name:var(--font-community)]`}>
      <CommunityPageHeader title={lesson ? `Week ${week} · ${lesson.title}` : `Week ${week}`} />
      {lesson?.presentation_url ? (
        <a href={lesson.presentation_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-14 items-center rounded-[18px] bg-[#7C3AED] px-5 text-sm font-bold text-white">
          Slides
        </a>
      ) : (
        <p className="mt-4 text-sm text-[#4A3F66]">Slides for this week are not up yet.</p>
      )}
    </div>
  );
}
