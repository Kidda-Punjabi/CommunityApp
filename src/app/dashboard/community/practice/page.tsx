import { CommunityPageHeader } from "@/components/community/community-page-header";
import { loadCommunityHome, memberHasCommunity } from "@/lib/community/load-home";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { COMMUNITY_COURSE_ID } from "@/lib/topics/constants";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

export default async function CommunityPracticePage() {
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  if (!(await memberHasCommunity(admin, user.id))) return null;
  const home = await loadCommunityHome(admin, user.id);
  const { data: lesson } = home.next
    ? await admin.from("lessons").select("title, presentation_url").eq("course_id", COMMUNITY_COURSE_ID).eq("lesson_number", home.next.weekNumber).maybeSingle()
    : { data: null };

  return (
    <div className={`${ui.page} font-[family-name:var(--font-community)]`}>
      <CommunityPageHeader title="Practice" />
      <section className="mt-4 rounded-[24px] bg-[#5B21B6] p-4 text-white">
        <p className="text-sm text-violet-100">This week{home.next ? ` · Week ${home.next.weekNumber}` : ""}</p>
        <h2 className="font-heading text-2xl font-extrabold">{lesson?.title ?? home.next?.topic ?? "Your next session"}</h2>
        {lesson?.presentation_url ? (
          <a href={lesson.presentation_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-14 items-center rounded-[18px] bg-[#FDE68A] px-4 text-sm font-bold text-[#3B1A8C]">This week's slides</a>
        ) : null}
      </section>
      <div className="mt-3 grid gap-2">
        <Link href="/dashboard/learn" className="flex h-14 items-center rounded-[20px] bg-white px-4 font-bold text-[#1F1640]">Flashcards</Link>
        <Link href="/dashboard/games/voice-practice" className="flex h-14 items-center rounded-[20px] bg-white px-4 font-bold text-[#1F1640]">Speak It</Link>
      </div>
    </div>
  );
}