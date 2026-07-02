"use client";

import { ScheduleViewToggle, type ScheduleViewMode } from "@/components/schedule/schedule-view-toggle";
import { TimeGridCalendar } from "@/components/schedule/time-grid-calendar";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
import type { TimeGridSession } from "@/lib/calendar/time-grid-calendar";
import type { TutorSelfCalendarSession } from "@/lib/calendar/load-tutor-self-calendar";
import { cn, ui } from "@/lib/ui/styles";
import { useMemo, useState } from "react";

function sessionSubtitle(session: TutorSelfCalendarSession): string {
  if (session.excludedByTutor) return "Personal";
  if (session.cohortName) return `Group · ${session.cohortName}`;
  if (session.studentName) return `1-to-1 · ${session.studentName}`;
  if (session.matchMethod === "unmatched") return "Unmatched";
  return "Lesson";
}

function toTimeGridSessions(sessions: TutorSelfCalendarSession[]): TimeGridSession[] {
  return sessions.map((session) => ({
    id: session.id,
    title: session.title,
    starts_at: session.starts_at,
    ends_at: session.ends_at,
    meet_link: session.meet_link,
    subtitle: sessionSubtitle(session),
    personal: session.excludedByTutor,
    inviteeDot: null,
  }));
}

type TutorCalendarViewProps = {
  sessions: TutorSelfCalendarSession[];
};

export function TutorCalendarView({ sessions }: TutorCalendarViewProps) {
  const [viewMode, setViewMode] = useState<ScheduleViewMode>("week");
  const timeGridSessions = useMemo(() => toTimeGridSessions(sessions), [sessions]);

  const upcoming = sessions.filter((session) => new Date(session.starts_at) >= new Date());

  return (
    <section className="space-y-4">
      <div>
        <h2 className={ui.sectionTitle}>Your calendar</h2>
        <p className="text-xs text-zinc-500">
          {sessions.length} synced event{sessions.length === 1 ? "" : "s"} · faded events are
          marked personal
        </p>
      </div>

      <ScheduleViewToggle mode={viewMode} onChange={setViewMode} />

      {viewMode === "list" ? (
        upcoming.length === 0 ? (
          <div className={ui.emptyState}>
            <p className="font-semibold text-zinc-900">No upcoming events</p>
            <p className="mt-2 text-sm text-zinc-500">Sync Google Calendar to see your schedule here.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((session) => (
              <li
                key={session.id}
                className={cn(
                  ui.cardBordered,
                  session.excludedByTutor && "bg-zinc-50/80 opacity-80"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                      {sessionSubtitle(session)}
                    </p>
                    <p className="font-semibold text-zinc-900">{session.title}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {formatSessionWhen(session.starts_at, session.ends_at)}
                    </p>
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
              </li>
            ))}
          </ul>
        )
      ) : (
        <TimeGridCalendar
          sessions={timeGridSessions}
          mode={viewMode}
          emptyLabel="No events in this period."
        />
      )}
    </section>
  );
}
