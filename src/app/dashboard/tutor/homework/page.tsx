import { TutorHomeworkReview } from "@/components/tutor/tutor-homework-review";
import { TutorPageHeader } from "@/components/tutor/tutor-page-header";
import { loadPendingHomeworkReviews } from "@/lib/tutoring/homework-submissions";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";

export default async function TutorHomeworkPage() {
  const supabase = await createClient();
  const pendingHomework = await loadPendingHomeworkReviews(supabase);

  return (
    <div className={ui.page}>
      <TutorPageHeader
        title="Homework review"
        subtitle="Listen to voice homework and leave feedback for your students."
      />
      <TutorHomeworkReview submissions={pendingHomework} fullPage />
    </div>
  );
}
