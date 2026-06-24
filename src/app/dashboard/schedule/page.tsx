import { UpcomingLessonsList } from "@/components/schedule/upcoming-lessons-list";
import { loadStudentUpcomingSessions } from "@/lib/calendar/load-sessions";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";

export default async function StudentSchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const sessions = await loadStudentUpcomingSessions(supabase, user!.id);

  return (
    <div className={ui.page}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Upcoming lessons</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Live sessions with your tutor. Join from here when it&apos;s time.
        </p>
      </div>

      <UpcomingLessonsList sessions={sessions} />
    </div>
  );
}
