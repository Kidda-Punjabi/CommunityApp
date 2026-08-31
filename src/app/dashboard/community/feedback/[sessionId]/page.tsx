import { LessonFeedbackForm } from "@/components/feedback/lesson-feedback-form";
import { BackLink } from "@/components/navigation/back-link";
import { loadCommunityClassFeedbackContext } from "@/lib/feedback/community-class";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { ui } from "@/lib/ui/styles";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function CommunityClassFeedbackPage({ params }: PageProps) {
  const { sessionId } = await params;
  const { user, supabase } = await requireNoKidCommunityAccess();

  if (!user.email) notFound();

  const loaded = await loadCommunityClassFeedbackContext(
    supabase,
    user.id,
    user.email,
    sessionId,
    { phone: user.phone }
  );

  if (!loaded.ok) notFound();

  return (
    <div className={ui.page}>
      <BackLink fallbackHref="/dashboard/community">← Back to Community</BackLink>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-600">
          Kidda Community Class
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">Class feedback</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {loaded.alreadySubmitted
            ? "You've already submitted feedback for this class."
            : "How was this Community Class? Your ratings help us improve the open sessions."}
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        {loaded.alreadySubmitted ? (
          <p className="text-sm text-zinc-600">
            Thanks — feedback for {loaded.context.lessonLabel}
            {loaded.context.tutor ? ` with ${loaded.context.tutor}` : ""} is already in.
          </p>
        ) : (
          <LessonFeedbackForm
            context={loaded.context}
            sessionId={loaded.context.sessionId}
          />
        )}
      </div>
    </div>
  );
}
