"use client";

import { useActionState, useState } from "react";
import {
  resolveRescheduleRequest,
  setSessionReschedulingAllowed,
  type CalendarActionResult,
} from "@/app/dashboard/tutor/calendar-actions";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
import type { TutorScheduledSession } from "@/lib/calendar/types";
import { ui } from "@/lib/ui/styles";

const initial: CalendarActionResult = {};

type TutorRescheduleInboxProps = {
  requests: Array<{
    id: string;
    session_id: string;
    message: string;
    preferred_times: string | null;
    studentName: string;
    sessionTitle: string;
    sessionStartsAt: string | null;
    sessionEndsAt: string | null;
  }>;
};

export function TutorRescheduleInbox({ requests }: TutorRescheduleInboxProps) {
  if (requests.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className={ui.sectionTitle}>Reschedule requests</h2>
      {requests.map((request) => (
        <RescheduleRequestCard key={request.id} request={request} />
      ))}
    </section>
  );
}

function RescheduleRequestCard({
  request,
}: {
  request: TutorRescheduleInboxProps["requests"][number];
}) {
  const [state, action, pending] = useActionState(resolveRescheduleRequest, initial);

  return (
    <div className={`${ui.cardBordered} space-y-3`}>
      <div>
        <p className="font-semibold text-zinc-900">{request.studentName}</p>
        <p className="text-sm text-zinc-600">{request.sessionTitle}</p>
        {request.sessionStartsAt && request.sessionEndsAt ? (
          <p className="mt-1 text-sm text-zinc-500">
            {formatSessionWhen(request.sessionStartsAt, request.sessionEndsAt)}
          </p>
        ) : null}
      </div>
      <p className="text-sm text-zinc-700">{request.message}</p>
      {request.preferred_times ? (
        <p className="text-sm text-zinc-500">
          <span className="font-medium">Preferred times:</span> {request.preferred_times}
        </p>
      ) : null}

      <form action={action} className="space-y-3">
        <input type="hidden" name="request_id" value={request.id} />
        <textarea
          name="tutor_response"
          rows={2}
          placeholder="Optional note to the student"
          className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm"
        />
        {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            name="decision"
            value="approved"
            disabled={pending}
            className={ui.btnPrimary}
          >
            Approve
          </button>
          <button
            type="submit"
            name="decision"
            value="denied"
            disabled={pending}
            className={ui.btnSecondary}
          >
            Decline
          </button>
        </div>
      </form>
    </div>
  );
}

type TutorUpcomingSessionsListProps = {
  sessions: TutorScheduledSession[];
};

export function TutorUpcomingSessionsList({ sessions }: TutorUpcomingSessionsListProps) {
  if (sessions.length === 0) {
    return (
      <div className={ui.emptyState}>
        <p className="font-semibold text-zinc-900">No upcoming lessons synced yet</p>
        <p className="mt-2 text-sm text-zinc-500">
          Connect Google Calendar and sync — lessons with your students as attendees will appear
          here.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {sessions.map((session) => (
        <TutorSessionCard key={session.id} session={session} />
      ))}
    </ul>
  );
}

function TutorSessionCard({ session }: { session: TutorScheduledSession }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const toggleRescheduling = async () => {
    setPending(true);
    setMessage(null);
    const result = await setSessionReschedulingAllowed(
      session.id,
      !session.rescheduling_allowed
    );
    setMessage(result.success ?? result.error ?? null);
    setPending(false);
    if (result.success) window.location.reload();
  };

  const who =
    session.studentName ??
    (session.cohortName ? `Group · ${session.cohortName}` : "Unmatched event");

  return (
    <li className={ui.cardBordered}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-zinc-900">{session.title}</p>
          <p className="mt-1 text-sm text-zinc-600">{who}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {formatSessionWhen(session.starts_at, session.ends_at)}
          </p>
          {session.match_method === "unmatched" ? (
            <p className="mt-2 text-xs font-medium text-amber-700">
              Could not match to a student — add them as a calendar attendee or include their name
              in the event title.
            </p>
          ) : null}
          {session.pendingRescheduleCount > 0 ? (
            <p className="mt-2 text-xs font-semibold text-violet-700">
              {session.pendingRescheduleCount} pending reschedule request
              {session.pendingRescheduleCount === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
        {session.meet_link ? (
          <a href={session.meet_link} target="_blank" rel="noopener noreferrer" className={ui.btnPrimary}>
            Join
          </a>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => void toggleRescheduling()}
          className={ui.btnGhost}
        >
          {session.rescheduling_allowed ? "Lock rescheduling" : "Allow rescheduling"}
        </button>
        {message ? <span className="text-xs text-zinc-500">{message}</span> : null}
      </div>
    </li>
  );
}
