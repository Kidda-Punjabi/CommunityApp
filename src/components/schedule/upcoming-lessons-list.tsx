"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  cancelRescheduleRequest,
  requestCohortSwitch,
  requestLessonReschedule,
  type CalendarActionResult,
} from "@/app/dashboard/tutor/calendar-actions";
import { CancelCohortSwitchRequestControl } from "@/components/schedule/cancel-cohort-switch-request-control";
import { LessonsViewToggle, type LessonsViewMode } from "@/components/schedule/lessons-view-toggle";
import { MonthLessonsCalendar } from "@/components/schedule/month-lessons-calendar";
import { COHORT_SWITCH_CUTOFF_MS, RESCHEDULE_CUTOFF_MS } from "@/lib/calendar/constants";
import { COHORT_SWITCH_WARNING, GROUP_LESSON_POLICY_NOTE } from "@/lib/calendar/cohort-switch-policy";
import { formatSessionWhen, hoursUntilSession } from "@/lib/calendar/reschedule-policy";
import type { StudentScheduledSession } from "@/lib/calendar/types";
import { ui } from "@/lib/ui/styles";

const initial: CalendarActionResult = {};

type UpcomingLessonsListProps = {
  sessions: StudentScheduledSession[];
  hasBookingCredit?: boolean;
};

export function UpcomingLessonsList({ sessions, hasBookingCredit = false }: UpcomingLessonsListProps) {
  const [viewMode, setViewMode] = useState<LessonsViewMode>("list");

  if (sessions.length === 0) {
    return (
      <div className={ui.emptyState}>
        <p className="font-semibold text-zinc-900">No upcoming live lessons</p>
        {hasBookingCredit ? (
          <p className="mt-2 text-sm text-zinc-500">
            You have a paid 1-to-1 session credit — choose a time in the booking section above.
            After you confirm a slot, your lesson and Google Meet join link will appear here.
          </p>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">
            When your tutor adds you to a Google Calendar invite, your live lessons will show up here
            with a join link. For 1-to-1 packages, you can also book a time yourself once your tutor
            has opened self-serve scheduling.
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <LessonsViewToggle mode={viewMode} onChange={setViewMode} />
      {viewMode === "list" ? (
        <ul className="space-y-4">
          {sessions.map((session) => (
            <LessonSessionCard key={session.id} session={session} />
          ))}
        </ul>
      ) : (
        <MonthLessonsCalendar
          sessions={sessions.map((session) => ({
            id: session.id,
            title: session.lessonLabel,
            starts_at: session.starts_at,
            ends_at: session.ends_at,
            meet_link: session.meet_link,
            subtitle: session.tutorName,
          }))}
          emptySelectionLabel="No lessons on this day."
        />
      )}
    </div>
  );
}

function LessonSessionCard({ session }: { session: StudentScheduledSession }) {
  const hoursLeft = hoursUntilSession(session.starts_at);
  const isGroupLesson = Boolean(session.cohort_id);
  const cohortSwitchCutoffHours = COHORT_SWITCH_CUTOFF_MS / (60 * 60 * 1000);
  const rescheduleCutoffHours = RESCHEDULE_CUTOFF_MS / (60 * 60 * 1000);
  const cohortSwitchLocked =
    isGroupLesson && hoursLeft < cohortSwitchCutoffHours && hoursLeft > 0;
  const rescheduleLocked =
    !isGroupLesson && hoursLeft < rescheduleCutoffHours && hoursLeft > 0;

  return (
    <li className={ui.cardBordered}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            {session.tutorName}
          </p>
          {isGroupLesson && session.cohortName ? (
            <p className="mt-1 text-xs font-medium text-zinc-500">Group · {session.cohortName}</p>
          ) : !isGroupLesson ? (
            <p className="mt-1 text-xs font-medium text-zinc-500">1-to-1</p>
          ) : null}
          <p className="mt-1 font-semibold text-zinc-900">{session.lessonLabel}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {formatSessionWhen(session.starts_at, session.ends_at)}
          </p>
          {session.title && session.title !== session.lessonLabel ? (
            <p className="mt-1 truncate text-xs text-zinc-400">{session.title}</p>
          ) : null}
          {cohortSwitchLocked ? (
            <p className="mt-2 text-xs font-medium text-amber-700">
              Starts in {Math.max(1, Math.round(hoursLeft))}h — alternate cohort requests are
              closed (need 3 days notice)
            </p>
          ) : null}
          {rescheduleLocked ? (
            <p className="mt-2 text-xs font-medium text-amber-700">
              Starts in {Math.max(1, Math.round(hoursLeft))}h — rescheduling is locked
            </p>
          ) : null}
          {isGroupLesson && !session.cohortSwitchRequest ? (
            <p className="mt-2 text-xs text-zinc-500">{GROUP_LESSON_POLICY_NOTE}</p>
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
          Your tutor approved a reschedule. Check your calendar for the updated time.
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

      {session.cohortSwitchRequest?.status === "pending" ? (
        <CancelCohortSwitchRequestControl
          request={session.cohortSwitchRequest}
          className="mt-3"
        />
      ) : null}

      <div className="mt-3">
        <Link href={`/dashboard/schedule/${session.id}`} className={ui.btnGhost}>
          View lesson →
        </Link>
      </div>
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

export function RescheduleRequestForm({
  sessionId,
  onDone,
}: {
  sessionId: string;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(requestLessonReschedule, initial);
  const [open, setOpen] = useState(false);

  if (state.success) {
    return <p className="mt-3 text-sm text-emerald-700">{state.success}</p>;
  }

  if (!open) {
    return (
      <div className="mt-3">
        <button type="button" onClick={() => setOpen(true)} className={ui.btnPrimary}>
          I need to reschedule
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="mt-3 space-y-3 border-t border-zinc-100 pt-3">
      <input type="hidden" name="session_id" value={sessionId} />
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Why do you need to reschedule?
        </label>
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
        Requests must be made at least 24 hours before the lesson. Beginners 1-to-1 students get up
        to 2 reschedules for the course — please only ask if you genuinely need to change your
        class.
      </p>
      {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={ui.btnPrimary}>
          {pending ? "Sending…" : "Send request"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onDone?.();
          }}
          className={ui.btnGhost}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function CohortSwitchRequestForm({
  session,
  onDone,
}: {
  session: StudentScheduledSession;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(requestCohortSwitch, initial);
  const [open, setOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState("");

  if (state.success) {
    return <p className="mt-3 text-sm text-emerald-700">{state.success}</p>;
  }

  if (!open) {
    return (
      <div className="mt-3">
        <button type="button" onClick={() => setOpen(true)} className={ui.btnPrimary}>
          I need to reschedule
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="mt-3 space-y-3 border-t border-zinc-100 pt-3">
      <input type="hidden" name="session_id" value={session.id} />
      <input type="hidden" name="to_session_id" value={selectedSessionId} />
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Which matching session would you like to join instead?
        </label>
        <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
          {session.alternateCohorts.map((cohort) => {
            const selected = selectedSessionId === cohort.id;
            return (
              <button
                key={cohort.id}
                type="button"
                onClick={() => setSelectedSessionId(cohort.id)}
                className={
                  selected
                    ? "rounded-2xl border-2 border-violet-500 bg-violet-50 px-4 py-3 text-left"
                    : "rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left hover:border-violet-300"
                }
                aria-pressed={selected}
              >
                <p className="font-semibold text-zinc-900">{cohort.name}</p>
                <p className="mt-1 text-sm text-zinc-600">{cohort.tutorName}</p>
                <p className="mt-2 text-sm font-medium text-violet-700">
                  {new Date(cohort.startsAt).toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  ·{" "}
                  {new Date(cohort.startsAt).toLocaleTimeString("en-GB", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}{" "}
                  -{" "}
                  {new Date(cohort.endsAt).toLocaleTimeString("en-GB", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Why do you need a different group?
        </label>
        <textarea
          name="message"
          required
          rows={3}
          className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm"
          placeholder="Brief explanation for your tutor"
        />
      </div>
      <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-900">{COHORT_SWITCH_WARNING}</p>
      <p className="text-xs text-zinc-500">
        You need to let us know at least 3 days before the lesson. Beginners group students get up
        to 2 alternate cohort requests for the course — please only request a different class if it
        is genuinely necessary.
      </p>
      {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={pending || !selectedSessionId} className={ui.btnPrimary}>
          {pending ? "Sending…" : "Send request"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setSelectedSessionId("");
            onDone?.();
          }}
          className={ui.btnGhost}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
