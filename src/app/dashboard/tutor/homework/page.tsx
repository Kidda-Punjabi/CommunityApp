import { TutorHomeworkReview } from "@/components/tutor/tutor-homework-review";
import { TutorReviewedHomework } from "@/components/tutor/tutor-reviewed-homework";
import { TutorPageHeader } from "@/components/tutor/tutor-page-header";
import {
  loadPendingHomeworkReviews,
  loadReviewedHomeworkSubmissions,
} from "@/lib/tutoring/homework-submissions";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";

export default async function TutorHomeworkPage() {
  const supabase = await createClient();
  const [pendingHomework, reviewedHomework] = await Promise.all([
    loadPendingHomeworkReviews(supabase),
    loadReviewedHomeworkSubmissions(supabase),
  ]);

  return (
    <div className={ui.page}>
      <TutorPageHeader
        title="Homework review"
        subtitle="Listen to voice homework and leave feedback for your students."
      />
      <TutorHomeworkReview submissions={pendingHomework} fullPage />
      <div className="mt-8">
        <TutorReviewedHomework submissions={reviewedHomework} />
      </div>
    </div>
  );
}
