"use client";

import {
  fetchAdminTutorCalendars,
  notifyTutorsToSyncCalendar,
  resyncAllTutorCalendarsForAdmin,
  resyncTutorCalendarForAdmin,
} from "@/app/admin/content/calendar-actions";
import { AdminFilterPill, AdminStatusPill } from "@/components/admin/admin-filter-pills";
import {
  CalendarSessionLegend,
  SessionTitleWithInviteeDot,
} from "@/components/admin/calendar-session-legend";
import { CalendarSchemaNotice } from "@/components/schedule/calendar-schema-notice";
import { ScheduleViewToggle, type ScheduleViewMode } from "@/components/schedule/schedule-view-toggle";
import { TimeGridCalendar } from "@/components/schedule/time-grid-calendar";
import {
  formatAttendeeAccountSummary,
  formatInviteeDotSummary,
  isAdminSessionPersonal,
} from "@/lib/admin/calendar-session-display";
import type { AdminTutorCalendarRow, AdminTutorCalendarSession, AttendeeAccountStatus } from "@/lib/admin/load-admin-tutor-calendars";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
import type { TimeGridSession } from "@/lib/calendar/time-grid-calendar";
import { cn, ui } from "@/lib/ui/styles";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

function formatSyncTime(iso: string | null): string {
  if (!iso) return "Never synced";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatMatchLabel(session: AdminTutorCalendarSession): string | null {
  if (session.excludedByTutor) return null;
  switch (session.matchMethod) {
    case "attendee_email":
      return null;
    case "title_name":
      return "Matched by name in title";
    case "manual":
      return "Manually matched";
    case "unmatched":
      return null;
    default:
      return null;
  }
}

function sessionSubtitle(session: AdminTutorCalendarSession): string {
  const who = session.cohortName
    ? `Group · ${session.cohortName}`
    : session.studentName
      ? `1-to-1 · ${session.studentName}`
      : session.matchMethod === "unmatched"
        ? "Unmatched"
        : "Event";
  return `${session.tutorName} · ${who}`;
}

function SessionAttendeeList({ attendees }: { attendees: AttendeeAccountStatus[] }) {
  if (attendees.length === 0) {
    return <p className="mt-2 text-xs text-zinc-500">No other attendees on the calendar invite.</p>;
  }

  return (
    <ul className="mt-2 space-y-1">
      {attendees.map((attendee) => (
        <li key={attendee.email} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-700">{attendee.displayName ?? attendee.email}</span>
          {attendee.displayName ? (
            <span className="text-zinc-400">{attendee.email}</span>
          ) : null}
          <AdminStatusPill tone={attendee.hasAccount ? "green" : "amber"}>
            {attendee.hasAccount ? "Has account" : "No account"}
          </AdminStatusPill>
        </li>
      ))}
    </ul>
  );
}

function toTimeGridSessions(
  sessions: AdminTutorCalendarSession[],
  tutorColorIndex: Map<string, number>
): TimeGridSession[] {
  return sessions.map((session) => ({
    id: session.id,
    title: session.title,
    starts_at: session.starts_at,
    ends_at: session.ends_at,
    meet_link: session.meet_link,
    subtitle: sessionSubtitle(session),
    detail: formatAttendeeAccountSummary(session.attendees),
    colorIndex: tutorColorIndex.get(session.tutorId) ?? 0,
    personal: isAdminSessionPersonal(session),
    inviteeDot: session.inviteeDot,
  }));
}

export function AdminCalendarSection() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaReady, setSchemaReady] = useState(true);
  const [tutors, setTutors] = useState<AdminTutorCalendarRow[]>([]);
  const [sessions, setSessions] = useState<AdminTutorCalendarSession[]>([]);
  const [visibleTutorIds, setVisibleTutorIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ScheduleViewMode>("week");
  const [notifyMessage, setNotifyMessage] = useState<string | null>(null);
  const [pendingNotify, startNotify] = useTransition();
  const [pendingResync, startResync] = useTransition();
  const [syncingTutorId, setSyncingTutorId] = useState<string | null>(null);

  const applyCalendarResult = useCallback((result: Awaited<ReturnType<typeof fetchAdminTutorCalendars>>) => {
    setTutors(result.tutors);
    setSessions(result.sessions);
    setSchemaReady(result.schemaReady);
    setError(result.error ?? null);
    setLoadFailed(false);
    setVisibleTutorIds((current) => {
      if (current.size === 0) {
        return new Set(result.tutors.map((tutor) => tutor.tutorId));
      }
      const next = new Set<string>();
      for (const tutorId of current) {
        if (result.tutors.some((tutor) => tutor.tutorId === tutorId)) {
          next.add(tutorId);
        }
      }
      return next.size > 0 ? next : new Set(result.tutors.map((tutor) => tutor.tutorId));
    });
  }, []);

  const loadCalendars = useCallback(
    async (mode: "initial" | "refresh" = "refresh") => {
      if (mode === "initial") {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setLoadFailed(false);

      try {
        const result = await fetchAdminTutorCalendars();
        applyCalendarResult(result);
      } catch (e) {
        setLoadFailed(true);
        setError(e instanceof Error ? e.message : "Failed to load tutor calendars.");
      } finally {
        if (mode === "initial") {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [applyCalendarResult]
  );

  useEffect(() => {
    void loadCalendars("initial");
  }, [loadCalendars]);

  const unsyncedTutors = useMemo(
    () => tutors.filter((tutor) => !tutor.connected),
    [tutors]
  );

  const visibleSessions = useMemo(
    () => sessions.filter((session) => visibleTutorIds.has(session.tutorId)),
    [sessions, visibleTutorIds]
  );

  const tutorColorIndex = useMemo(() => {
    const map = new Map<string, number>();
    tutors.forEach((tutor, index) => {
      map.set(tutor.tutorId, index);
    });
    return map;
  }, [tutors]);

  const timeGridSessions = useMemo(
    () => toTimeGridSessions(visibleSessions, tutorColorIndex),
    [visibleSessions, tutorColorIndex]
  );

  const toggleTutor = (tutorId: string) => {
    setVisibleTutorIds((current) => {
      const next = new Set(current);
      if (next.has(tutorId)) {
        next.delete(tutorId);
      } else {
        next.add(tutorId);
      }
      return next;
    });
  };

  const showAllTutors = () => {
    setVisibleTutorIds(new Set(tutors.map((tutor) => tutor.tutorId)));
  };

  const hideAllTutors = () => {
    setVisibleTutorIds(new Set());
  };

  const sendSyncReminder = (tutorIds: string[]) => {
    setNotifyMessage(null);
    startNotify(async () => {
      const result = await notifyTutorsToSyncCalendar(tutorIds);
      setNotifyMessage(result.success ?? result.error ?? null);
    });
  };

  const resyncAllCalendars = () => {
    setNotifyMessage(null);
    startResync(async () => {
      const result = await resyncAllTutorCalendarsForAdmin();
      setNotifyMessage(result.success ?? result.error ?? null);
      if (result.success) void loadCalendars("refresh");
    });
  };

  const resyncTutorCalendar = (tutorId: string) => {
    setNotifyMessage(null);
    setSyncingTutorId(tutorId);
    void resyncTutorCalendarForAdmin(tutorId).then((result) => {
      setSyncingTutorId(null);
      setNotifyMessage(result.success ?? result.error ?? null);
      if (result.success) void loadCalendars("refresh");
    });
  };

  const connectedTutors = useMemo(() => tutors.filter((tutor) => tutor.connected), [tutors]);

  if (loading) {
    return (
      <div className={ui.page}>
        <p className="text-sm text-zinc-500">Loading tutor calendars…</p>
      </div>
    );
  }

  if (loadFailed && tutors.length === 0) {
    return (
      <div className={ui.page}>
        <div className="mb-6">
          <Link href="/admin/content" className="text-sm font-medium text-violet-600 hover:text-violet-500">
            ← Admin home
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">Tutor calendars</h1>
        </div>
        <div className={`${ui.cardBordered} space-y-3 p-5`}>
          <p className="font-semibold text-zinc-900">Couldn&apos;t load tutor calendars</p>
          <p className="text-sm text-zinc-600">
            {error ?? "The request failed or timed out. Try refreshing — your data is still in Google Calendar."}
          </p>
          <button
            type="button"
            onClick={() => void loadCalendars("refresh")}
            disabled={refreshing}
            className={ui.btnPrimary}
          >
            {refreshing ? "Refreshing…" : "Refresh calendars"}
          </button>
        </div>
      </div>
    );
  }

  if (!schemaReady) {
    return <CalendarSchemaNotice />;
  }

  return (
    <div className={ui.page}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/content" className="text-sm font-medium text-violet-600 hover:text-violet-500">
            ← Admin home
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">Tutor calendars</h1>
          <p className="mt-1 text-sm text-zinc-500">
            View tutor calendars, sync everyone from Google, and nudge tutors who haven&apos;t connected
            yet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadCalendars("refresh")}
          disabled={refreshing}
          className={ui.btnSecondary}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void loadCalendars("refresh")}
              disabled={refreshing}
              className={ui.btnGhost}
            >
              {refreshing ? "Refreshing…" : "Try again"}
            </button>
          </div>
        </div>
      ) : null}

      {notifyMessage ? (
        <p
          className={cn(
            "mb-4 rounded-2xl border px-4 py-3 text-sm",
            notifyMessage.includes("sent") ||
              notifyMessage.includes("Synced") ||
              notifyMessage.includes("synced")
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          )}
        >
          {notifyMessage}
        </p>
      ) : null}

      <section className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={ui.sectionTitle}>Sync status</h2>
          <div className="flex flex-wrap gap-2">
            {connectedTutors.length > 0 ? (
              <button
                type="button"
                disabled={pendingResync}
                onClick={resyncAllCalendars}
                className={ui.btnPrimary}
              >
                {pendingResync
                  ? "Syncing all calendars…"
                  : `Sync all calendars (${connectedTutors.length})`}
              </button>
            ) : null}
            {unsyncedTutors.length > 0 ? (
              <button
                type="button"
                disabled={pendingNotify}
                onClick={() => sendSyncReminder(unsyncedTutors.map((tutor) => tutor.tutorId))}
                className={ui.btnSecondary}
              >
                Notify all unsynced ({unsyncedTutors.length})
              </button>
            ) : null}
          </div>
        </div>

        {tutors.length === 0 ? (
          <p className="text-sm text-zinc-500">No tutors found.</p>
        ) : (
          <ul className="space-y-2">
            {tutors.map((tutor) => (
              <li key={tutor.tutorId} className={`${ui.cardBordered} flex flex-wrap items-center gap-3 p-4`}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-zinc-900">{tutor.displayName}</p>
                  {tutor.email ? <p className="text-sm text-zinc-500">{tutor.email}</p> : null}
                  {tutor.connected ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      {tutor.googleAccountEmail ?? "Google account"} · Last synced{" "}
                      {formatSyncTime(tutor.lastSyncedAt)}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AdminStatusPill tone={tutor.connected ? "green" : "amber"}>
                    {tutor.connected ? "Synced" : "Not synced"}
                  </AdminStatusPill>
                  <span className="text-xs text-zinc-500">
                    {tutor.loadedEventCount} event{tutor.loadedEventCount === 1 ? "" : "s"}
                    {tutor.upcomingLessonCount !== tutor.loadedEventCount
                      ? ` (${tutor.upcomingLessonCount} upcoming)`
                      : ""}
                  </span>
                  {!tutor.connected ? (
                    <button
                      type="button"
                      disabled={pendingNotify}
                      onClick={() => sendSyncReminder([tutor.tutorId])}
                      className={ui.btnGhost}
                    >
                      Send reminder
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={syncingTutorId === tutor.tutorId || pendingResync}
                      onClick={() => resyncTutorCalendar(tutor.tutorId)}
                      className={ui.btnGhost}
                    >
                      {syncingTutorId === tutor.tutorId ? "Syncing…" : "Sync now"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className={ui.sectionTitle}>Calendar events</h2>
            {visibleTutorIds.size > 0 ? (
              <p className="text-xs text-zinc-500">
                {visibleSessions.length} event{visibleSessions.length === 1 ? "" : "s"} loaded
                {sessions.length !== visibleSessions.length
                  ? ` (${sessions.length} total across selected tutors)`
                  : ""}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={showAllTutors} className={ui.btnGhost}>
              Show all
            </button>
            <button type="button" onClick={hideAllTutors} className={ui.btnGhost}>
              Hide all
            </button>
          </div>
        </div>

        <CalendarSessionLegend sampleColorIndex={0} />

        <div className="flex flex-wrap gap-2">
          {tutors.map((tutor) => (
            <AdminFilterPill
              key={tutor.tutorId}
              label={tutor.displayName}
              active={visibleTutorIds.has(tutor.tutorId)}
              colorIndex={tutorColorIndex.get(tutor.tutorId)}
              onClick={() => toggleTutor(tutor.tutorId)}
            />
          ))}
        </div>

        {visibleTutorIds.size === 0 ? (
          <p className="text-sm text-zinc-500">Select at least one tutor to see their lessons.</p>
        ) : (
          <div>
            <ScheduleViewToggle mode={viewMode} onChange={setViewMode} />
            {viewMode === "list" ? (
              visibleSessions.length === 0 ? (
                <div className={ui.emptyState}>
                  <p className="font-semibold text-zinc-900">No upcoming events</p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Visible tutors have no synced upcoming calendar events yet. Try re-syncing from
                    their tutor calendar page.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {visibleSessions.map((session) => {
                    const matchLabel = formatMatchLabel(session);
                    const personal = isAdminSessionPersonal(session);
                    const inviteeDotSummary = formatInviteeDotSummary(session.inviteeDot, session.attendees);
                    return (
                      <li
                        key={session.id}
                        className={cn(
                          ui.cardBordered,
                          personal && "bg-zinc-50/80 opacity-80"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                                {session.tutorName}
                              </p>
                              {matchLabel ? (
                                <AdminStatusPill tone="zinc">{matchLabel}</AdminStatusPill>
                              ) : null}
                            </div>
                            <p className="font-semibold text-zinc-900">
                              <SessionTitleWithInviteeDot
                                title={session.title}
                                inviteeDot={session.inviteeDot}
                              />
                            </p>
                            {inviteeDotSummary ? (
                              <p className="mt-1 text-xs text-zinc-500">{inviteeDotSummary}</p>
                            ) : null}
                            <p className="mt-1 text-sm text-zinc-600">
                              {session.cohortName
                                ? `Group · ${session.cohortName}`
                                : session.studentName
                                  ? `1-to-1 · ${session.studentName}`
                                  : "No matched student"}
                            </p>
                            <p className="mt-1 text-sm text-zinc-500">
                              {formatSessionWhen(session.starts_at, session.ends_at)}
                            </p>
                            <SessionAttendeeList attendees={session.attendees} />
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
                    );
                  })}
                </ul>
              )
            ) : (
              <TimeGridCalendar
                sessions={timeGridSessions}
                mode={viewMode}
                emptyLabel="No lessons in this period for the selected tutors."
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
