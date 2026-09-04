import { LessonFeedbackForm } from "@/components/feedback/lesson-feedback-form";
import { loadFeedbackContext } from "@/lib/feedback/load-feedback-context";
import { getTestimonialCalendarUrl } from "@/lib/ghl/testimonial-calendar";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function FeedbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) redirect("/login");

  const context = await loadFeedbackContext(supabase, user.id, user.email, {
    phone: user.phone,
  });

  return (
    <div className={ui.page}>
      <Link
        href="/dashboard/profile"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to profile
      </Link>

      <div className="mt-4">
        <h1 className="text-2xl font-bold text-zinc-900">Lesson feedback</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Share how your learning is going. Your course, cohort, and tutor are filled in
          automatically from your account.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <LessonFeedbackForm context={context} testimonialCalendarUrl={getTestimonialCalendarUrl()} />
      </div>
    </div>
  );
}
