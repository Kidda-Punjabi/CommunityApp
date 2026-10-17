import { COMMUNITY_COURSE_ID } from "@/lib/topics/constants";
import { loadCommunityHome, memberHasCommunity } from "@/lib/community/load-home";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
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
      : Promise.resolve({ data: [] }),
  ]);
  const been = new Set(
    (attended ?? [])
      .filter((row) => ((row.community_checkins ?? []) as { user_id: string }[]).some((checkin) => checkin.user_id === user.id))
      .map((row) => row.week_number_override ?? row.week_number)
  );
  return (
    <div className={ui.page}>
      <Link href="/dashboard/community" className="text-sm font-semibold text-violet-700">Community</Link>
      <h1 className="mt-2 font-heading text-2xl font-bold">Topics</h1>
      <ol className="mt-4 space-y-2">
        {(lessons ?? []).map((lesson) => (
          <li key={lesson.id} className="rounded-2xl bg-white px-4 py-3">
            <p className="text-sm font-semibold text-zinc-900">Week {lesson.lesson_number} · {lesson.title}</p>
            <p className="text-xs text-zinc-500">{been.has(lesson.lesson_number) ? "Attended" : "Catch up"}</p>
            {lesson.presentation_url ? (
              <a href={lesson.presentation_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-violet-700">
                Slides
              </a>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
