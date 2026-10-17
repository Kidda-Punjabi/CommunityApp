import { TutorHomeworkReview } from "@/components/tutor/tutor-homework-review";
import { TutorPageHeader } from "@/components/tutor/tutor-page-header";
import { isMasterAdmin } from "@/lib/auth/admin-access";
import { loadHomeworkReviewBoard } from "@/lib/tutoring/homework-review-board";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";

export default async function TutorHomeworkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const board = await loadHomeworkReviewBoard(supabase, user!.id);
  const viewerIsAdmin = await isMasterAdmin(user!.id, supabase);

  return (
    <div className={ui.page}>
      <TutorPageHeader
        title="Homework review"
        subtitle="Listen to voice homework and leave feedback for your students."
      />
      <TutorHomeworkReview
        submissions={board.pendingSubmissions}
        packages={board.packages}
        reviewedSubmissions={board.reviewedSubmissions}
        viewerUserId={user!.id}
        viewerIsAdmin={viewerIsAdmin}
        fullPage
      />
    </div>
  );
}
