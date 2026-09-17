import { TutorHomeworkReview } from "@/components/tutor/tutor-homework-review";
import { TutorPageHeader } from "@/components/tutor/tutor-page-header";
import { loadPendingHomeworkReviews } from "@/lib/tutoring/homework-submissions";
import { loadTutorDashboard } from "@/lib/tutoring/load-tutor-dashboard";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";

export default async function TutorHomeworkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [pendingHomework, data] = await Promise.all([
    loadPendingHomeworkReviews(supabase),
    loadTutorDashboard(supabase, user!.id),
  ]);

  return (
    <div className={ui.page}>
      <TutorPageHeader
        title="Homework review"
        subtitle="Listen to voice homework and leave feedback for your students."
      />
      <TutorHomeworkReview
        submissions={pendingHomework}
        cohorts={data.beginnersGroups}
        fullPage
      />
    </div>
  );
}
