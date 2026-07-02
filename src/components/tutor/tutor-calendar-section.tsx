"use client";

import { useActionState, useState } from "react";
import {
  excludeCalendarSession,
  linkSessionToPackage,
  resolveRescheduleRequest,
  setSessionReschedulingAllowed,
  updateTutorSessionLog,
  type CalendarActionResult,
} from "@/app/dashboard/tutor/calendar-actions";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
import type { TutorScheduledSession } from "@/lib/calendar/types";
import { LessonsViewToggle, type LessonsViewMode } from "@/components/schedule/lessons-view-toggle";
import { MonthLessonsCalendar } from "@/components/schedule/month-lessons-calendar";
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
  const [viewMode, setViewMode] = useState<LessonsViewMode>("list");

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
    <div>
      <LessonsViewToggle mode={viewMode} onChange={setViewMode} />
      {viewMode === "list" ? (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <TutorSessionCard key={session.id} session={session} />
          ))}
        </ul>
      ) : (
        <MonthLessonsCalendar
          sessions={sessions.map((session) => ({
            id: session.id,
            title: session.title,
            starts_at: session.starts_at,
            ends_at: session.ends_at,
            meet_link: session.meet_link,
            subtitle:
              session.studentName ??
              (session.cohortName ? `Group · ${session.cohortName}` : null),
          }))}
          emptySelectionLabel="No lessons on this day."
        />
      )}
    </div>
  );
}

function TutorSessionCard({ session }: { session: TutorScheduledSession }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [logState, logAction, logPending] = useActionState(updateTutorSessionLog, initial);

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

  const markNotALesson = async (scope: "event" | "series") => {
    setPending(true);
    setMessage(null);
    const result = await excludeCalendarSession(session.id, scope);
    setMessage(result.success ?? result.error ?? null);
    setPending(false);
    if (result.success) window.location.reload();
  };

  const linkSuggestedPackage = async (scope: "event" | "series") => {
    if (!session.suggestedPackageId) return;
    setPending(true);
    setMessage(null);
    const result = await linkSessionToPackage(session.id, session.suggestedPackageId, scope);
    setMessage(result.success ?? result.error ?? null);
    setPending(false);
    if (result.success) window.location.reload();
  };

  const who = session.cohort_id
    ? `Group · ${session.cohortName ?? "Cohort"}`
    : session.studentName
      ? `1-to-1 · ${session.studentName}`
      : "Unmatched event";

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
          {session.linkedPackageName ? (
            <p className="mt-2 text-xs font-medium text-emerald-700">
              Linked package: {session.linkedPackageName}
              {session.linkedBySeries ? " (series)" : ""}
              {session.linkedLessonCountInPackage > 0
                ? ` · ${session.linkedLessonCountInPackage} linked lessons`
                : ""}
            </p>
          ) : session.suggestedPackageName ? (
            <p className="mt-2 text-xs font-medium text-amber-700">
              Not linked yet — suggested package: {session.suggestedPackageName}
            </p>
          ) : (
            <p className="mt-2 text-xs font-medium text-rose-700">
              Not linked to any package yet.
            </p>
          )}
          <p className="mt-2 text-xs text-zinc-500">
            Log: {session.completed ? "Completed" : "Not completed"} · Attendance{" "}
            {session.attendanceStatus === "present"
              ? "present"
              : session.attendanceStatus === "absent_notified"
                ? "absent (notified)"
                : session.attendanceStatus === "absent_unnotified"
                  ? "absent (didn't tell us)"
                  : "not marked"}{" "}
            · Homework{" "}
            {session.homeworkMarked ? "marked" : "not marked"}
          </p>
        </div>
        {session.meet_link ? (
          <a href={session.meet_link} target="_blank" rel="noopener noreferrer" className={ui.btnPrimary}>
            Join
          </a>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!session.cohort_id ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void toggleRescheduling()}
            className={ui.btnGhost}
          >
            {session.rescheduling_allowed ? "Lock rescheduling" : "Allow rescheduling"}
          </button>
        ) : (
          <p className="text-xs text-zinc-500">
            Group lesson — students can request a different cohort (3 days notice), not a
            reschedule.
          </p>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => void markNotALesson("event")}
          className={ui.btnGhost}
        >
          Not a lesson
        </button>
        {session.suggestedPackageId && !session.linkedPackageId ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void linkSuggestedPackage("event")}
            className={ui.btnGhost}
          >
            Link package
          </button>
        ) : null}
        {session.google_recurring_event_id ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => void markNotALesson("series")}
              className={ui.btnGhost}
            >
              Not a lesson (whole series)
            </button>
            {session.suggestedPackageId && !session.linkedPackageId ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void linkSuggestedPackage("series")}
                className={ui.btnGhost}
              >
                Link package (whole series)
              </button>
            ) : null}
          </>
        ) : null}
        {message ? <span className="text-xs text-zinc-500">{message}</span> : null}
      </div>
      <form action={logAction} className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
        <input type="hidden" name="session_id" value={session.id} />
        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-600">
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" name="completed" defaultChecked={session.completed} />
            Lesson complete
          </label>
          <label className="inline-flex items-center gap-2">
            Attendance
            <select
              name="attendance_status"
              defaultValue={session.attendanceStatus ?? ""}
              className="rounded-xl border border-zinc-200 bg-white px-2 py-1 text-xs"
            >
              <option value="">Not marked</option>
              <option value="present">Present</option>
              <option value="absent_notified">Absent (notified us beforehand)</option>
              <option value="absent_unnotified">Absent (didn&apos;t tell us)</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              name="homework_marked"
              defaultChecked={session.homeworkMarked}
            />
            Homework marked
          </label>
        </div>
        <textarea
          name="notes"
          rows={2}
          placeholder="Optional lesson notes"
          className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-xs"
        />
        {logState.error ? <p className="text-xs text-rose-600">{logState.error}</p> : null}
        {logState.success ? <p className="text-xs text-emerald-700">{logState.success}</p> : null}
        <button type="submit" disabled={logPending} className={ui.btnGhost}>
          {logPending ? "Saving log…" : "Save lesson log"}
        </button>
      </form>
    </li>
  );
}
