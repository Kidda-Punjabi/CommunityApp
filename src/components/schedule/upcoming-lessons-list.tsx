"use client";

import { useActionState, useState } from "react";
import {
  cancelRescheduleRequest,
  requestLessonReschedule,
  type CalendarActionResult,
} from "@/app/dashboard/tutor/calendar-actions";
import { formatSessionWhen, hoursUntilSession } from "@/lib/calendar/reschedule-policy";
import type { StudentScheduledSession } from "@/lib/calendar/types";
import { ui } from "@/lib/ui/styles";

const initial: CalendarActionResult = {};

type UpcomingLessonsListProps = {
  sessions: StudentScheduledSession[];
};

export function UpcomingLessonsList({ sessions }: UpcomingLessonsListProps) {
  if (sessions.length === 0) {
    return (
      <div className={ui.emptyState}>
        <p className="font-semibold text-zinc-900">No upcoming live lessons</p>
        <p className="mt-2 text-sm text-zinc-500">
          When your tutor schedules lessons on Google Calendar, they&apos;ll show up here with a
          join link.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {sessions.map((session) => (
        <LessonSessionCard key={session.id} session={session} />
      ))}
    </ul>
  );
}

function LessonSessionCard({ session }: { session: StudentScheduledSession }) {
  const [showForm, setShowForm] = useState(false);
  const hoursLeft = hoursUntilSession(session.starts_at);

  return (
    <li className={ui.cardBordered}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            {session.tutorName}
          </p>
          <p className="mt-1 font-semibold text-zinc-900">{session.title}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {formatSessionWhen(session.starts_at, session.ends_at)}
          </p>
          {hoursLeft <= 24 && hoursLeft > 0 ? (
            <p className="mt-2 text-xs font-medium text-amber-700">
              Starts in {Math.max(1, Math.round(hoursLeft))}h — rescheduling is locked
            </p>
          ) : null}
        </div>
        {session.meet_link ? (
          <a
            href={session.meet_link}
            target="_blank"
            rel="noopener noreferrer"
            className={ui.btnPrimary}
          >
            Join
          </a>
        ) : null}
      </div>

      {session.rescheduleRequest?.status === "pending" ? (
        <PendingRequestBanner requestId={session.rescheduleRequest.id} />
      ) : null}

      {session.rescheduleRequest?.status === "approved" ? (
        <p className="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Your tutor approved a reschedule. Check with them for the new time.
          {session.rescheduleRequest.tutor_response
            ? ` Note: ${session.rescheduleRequest.tutor_response}`
            : ""}
        </p>
      ) : null}

      {session.rescheduleRequest?.status === "denied" ? (
        <p className="mt-3 rounded-2xl bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
          Reschedule request declined.
          {session.rescheduleRequest.tutor_response
            ? ` ${session.rescheduleRequest.tutor_response}`
            : " Please contact your tutor directly."}
        </p>
      ) : null}

      {session.canRequestReschedule && !showForm ? (
        <button type="button" className={`mt-3 ${ui.btnGhost}`} onClick={() => setShowForm(true)}>
          Request to reschedule
        </button>
      ) : null}

      {!session.canRequestReschedule && session.rescheduleLockedReason ? (
        <p className="mt-3 text-sm text-zinc-500">{session.rescheduleLockedReason}</p>
      ) : null}

      {showForm ? <RescheduleRequestForm sessionId={session.id} onDone={() => setShowForm(false)} /> : null}
    </li>
  );
}

function PendingRequestBanner({ requestId }: { requestId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const cancel = async () => {
    setPending(true);
    const result = await cancelRescheduleRequest(requestId);
    setMessage(result.success ?? result.error ?? null);
    setPending(false);
    if (result.success) window.location.reload();
  };

  return (
    <div className="mt-3 rounded-2xl bg-violet-50 px-3 py-2 text-sm text-violet-900">
      Reschedule request pending — your tutor will respond soon.
      <button
        type="button"
        disabled={pending}
        onClick={() => void cancel()}
        className="ml-2 font-semibold underline"
      >
        Cancel request
      </button>
      {message ? <span className="mt-1 block text-xs">{message}</span> : null}
    </div>
  );
}

function RescheduleRequestForm({
  sessionId,
  onDone,
}: {
  sessionId: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(requestLessonReschedule, initial);

  if (state.success) {
    return <p className="mt-3 text-sm text-emerald-700">{state.success}</p>;
  }

  return (
    <form action={action} className="mt-3 space-y-3 border-t border-zinc-100 pt-3">
      <input type="hidden" name="session_id" value={sessionId} />
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Why do you need to reschedule?</label>
        <textarea
          name="message"
          required
          rows={3}
          className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm"
          placeholder="Brief explanation for your tutor"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Preferred alternative times (optional)
        </label>
        <input
          name="preferred_times"
          type="text"
          className={ui.input}
          placeholder="e.g. Thu after 5pm, Sat morning"
        />
      </div>
      <p className="text-xs text-zinc-500">
        Requests must be made at least 24 hours before the lesson. Your tutor may not be able to
        accommodate every request.
      </p>
      {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={ui.btnPrimary}>
          {pending ? "Sending…" : "Send request"}
        </button>
        <button type="button" onClick={onDone} className={ui.btnGhost}>
          Cancel
        </button>
      </div>
    </form>
  );
}
