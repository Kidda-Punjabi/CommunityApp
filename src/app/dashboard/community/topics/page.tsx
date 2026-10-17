import { CommunityPageHeader } from "@/components/community/community-page-header";
import { loadCommunityHome, memberHasCommunity } from "@/lib/community/load-home";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { COMMUNITY_COURSE_ID } from "@/lib/topics/constants";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

export default async function CommunityTopicsPage() {
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  if (!(await memberHasCommunity(admin, user.id))) return null;
  const home = await loadCommunityHome(admin, user.id);
  const [{ data: lessons }, { data: attended }] = await Promise.all([
    admin.from("lessons").select("id, lesson_number, title, presentation_url").eq("course_id", COMMUNITY_COURSE_ID).order("lesson_number"),
    home.mainSessionId
      ? admin
          .from("community_session_occurrences")
          .select("week_number, week_number_override, ends_at, community_checkins(user_id)")
          .eq("session_id", home.mainSessionId)
          .lt("ends_at", new Date().toISOString())
      : Promise.resolve({ data: [] as { week_number: number; week_number_override: number | null; community_checkins: { user_id: string }[] | null }[] }),
  ]);
  const been = new Set(
    (attended ?? [])
      .filter((row) => ((row.community_checkins ?? []) as { user_id: string }[]).some((checkin) => checkin.user_id === user.id))
      .map((row) => row.week_number_override ?? row.week_number)
  );
  const current = home.next?.weekNumber ?? null;
  const currentLesson = (lessons ?? []).find((lesson) => lesson.lesson_number === current);

  return (
    <div className={`${ui.page} font-[family-name:var(--font-community)]`}>
      <CommunityPageHeader title="Topics" />
      {currentLesson ? (
        <section className="mt-4 rounded-[24px] bg-[#5B21B6] p-4 text-white">
          <p className="text-sm text-violet-100">This week · Week {currentLesson.lesson_number}</p>
          <h2 className="font-heading text-2xl font-extrabold">{currentLesson.title}</h2>
          <div className="mt-3 flex gap-2">
            {currentLesson.presentation_url ? (
              <a href={currentLesson.presentation_url} target="_blank" rel="noreferrer" className="inline-flex h-14 items-center rounded-[18px] bg-[#FDE68A] px-4 text-sm font-bold text-[#3B1A8C]">Slides</a>
            ) : null}
            <Link href="/dashboard/community/practice" className="inline-flex h-14 items-center rounded-[18px] bg-white px-4 text-sm font-bold text-[#5B21B6]">Practice</Link>
          </div>
        </section>
      ) : null}
      <ol className="mt-4 grid grid-cols-6 gap-2">
        {(lessons ?? []).map((lesson) => {
          const number = lesson.lesson_number;
          const attendedWeek = been.has(number);
          const upcoming = current != null && number > current;
          return (
            <li key={lesson.id}>
              <Link
                href={`/dashboard/community/topics/${number}`}
                className={`flex h-11 items-center justify-center rounded-2xl text-sm font-bold ${
                  number === current ? "bg-[#5B21B6] text-white" : upcoming ? "bg-white text-[#C4B8DC]" : "bg-white text-[#1F1640]"
                }`}
              >
                {attendedWeek ? "✓" : number}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
