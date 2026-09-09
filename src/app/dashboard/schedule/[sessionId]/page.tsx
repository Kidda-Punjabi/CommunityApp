import { notFound } from "next/navigation";
import { StudentLessonDetailView } from "@/components/schedule/student-lesson-detail-view";
import { loadStudentUpcomingSessions } from "@/lib/calendar/load-sessions";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function StudentLessonDetailPage({ params }: PageProps) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { sessions } = await loadStudentUpcomingSessions(supabase, user.id, user.email);
  const session = sessions.find((row) => row.id === sessionId);
  if (!session) notFound();

  return (
    <div className={ui.page}>
      <StudentLessonDetailView session={session} backHref="/dashboard/schedule" />
    </div>
  );
}
