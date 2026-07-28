import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CohortSwitchRequestForm,
  RescheduleRequestForm,
} from "@/components/schedule/upcoming-lessons-list";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
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

  const isGroup = Boolean(session.cohort_id);

  return (
    <div className={ui.page}>
      <p className="mb-4">
        <Link href="/dashboard/schedule" className="text-sm font-medium text-violet-600 hover:text-violet-500">
          ← Back to schedule
        </Link>
      </p>

      <div className={ui.cardBordered}>
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          {session.tutorName}
        </p>
        {isGroup && session.cohortName ? (
          <p className="mt-1 text-xs font-medium text-zinc-500">Group · {session.cohortName}</p>
        ) : (
          <p className="mt-1 text-xs font-medium text-zinc-500">1-to-1</p>
        )}
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
          {session.lessonLabel}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          {formatSessionWhen(session.starts_at, session.ends_at)}
        </p>
        {session.title ? (
          <p className="mt-2 text-sm text-zinc-600">{session.title}</p>
        ) : null}

        {session.meet_link ? (
          <a
            href={session.meet_link}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-4 inline-flex ${ui.btnPrimary}`}
          >
            Join lesson
          </a>
        ) : null}
      </div>

      {session.rescheduleRequest?.status === "pending" ? (
        <p className="mt-6 rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-900">
          You already have a pending reschedule request for this lesson.
        </p>
      ) : null}

      {session.canRequestReschedule ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-zinc-900">Request to reschedule</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Tell your tutor why you need a different time. They&apos;ll pick an available slot and
            update your calendar invite.
          </p>
          <RescheduleRequestForm sessionId={session.id} />
        </section>
      ) : !isGroup && session.rescheduleLockedReason && !session.rescheduleRequest ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-zinc-900">Request to reschedule</h2>
          <button type="button" disabled className={`${ui.btnGhost} mt-3 cursor-not-allowed opacity-60`}>
            Request to reschedule
          </button>
          <p className="mt-3 text-sm text-zinc-500">{session.rescheduleLockedReason}</p>
        </section>
      ) : null}

      {session.canRequestCohortSwitch ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-zinc-900">Request alternate cohort</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Group lessons can&apos;t be rescheduled to a new time — you can ask to join another cohort
            for this week instead.
          </p>
          <CohortSwitchRequestForm session={session} />
        </section>
      ) : isGroup && session.cohortSwitchLockedReason && !session.cohortSwitchRequest ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-zinc-900">Request alternate cohort</h2>
          <button type="button" disabled className={`${ui.btnGhost} mt-3 cursor-not-allowed opacity-60`}>
            Request alternate cohort
          </button>
          <p className="mt-3 text-sm text-zinc-500">{session.cohortSwitchLockedReason}</p>
        </section>
      ) : null}
    </div>
  );
}
