import { TutorHomeworkReview } from "@/components/tutor/tutor-homework-review";
import { TutorPageHeader } from "@/components/tutor/tutor-page-header";
import { loadHomeworkReviewBoard } from "@/lib/tutoring/homework-review-board";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";

export default async function TutorHomeworkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const board = await loadHomeworkReviewBoard(supabase, user!.id);

  return (
    <div className={ui.page}>
      <TutorPageHeader
        title="Homework review"
        subtitle="Listen to voice homework and leave feedback for your students."
      />
      <TutorHomeworkReview
        submissions={board.pendingSubmissions}
        packages={board.packages}
        reviewedKeys={board.reviewedKeys}
        fullPage
      />
    </div>
  );
}
