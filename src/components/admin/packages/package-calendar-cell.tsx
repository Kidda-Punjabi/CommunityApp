"use client";

import { useState, useTransition } from "react";
import {
  linkCohortCalendarMatch,
  linkPackageInstanceCalendarMatch,
  relinkCohortCalendarMatch,
  relinkPackageInstanceCalendarMatch,
  searchCohortCalendarMatches,
  searchPackageInstanceCalendarMatches,
  unlinkCohortCalendarMatch,
  unlinkPackageInstanceCalendarMatch,
  refreshPackageInstanceCalendarMatch,
} from "@/app/admin/packages/actions";
import type { AdminPackageListRow } from "@/lib/admin/packages/types";
import { formatSessionWhenUk } from "@/lib/calendar/uk-display-time";

type Candidate = {
  googleEventId: string;
  recurringEventId: string;
  title: string;
  nextStartsAt: string;
  nextEndsAt: string;
  weekday: string;
  timeLabel: string;
  score: number;
  reasons: string[];
};

type PackageCalendarCellProps = {
  row: AdminPackageListRow;
  onLinked: () => void;
};

export function PackageCalendarCell({ row, onLinked }: PackageCalendarCellProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [searchedEmpty, setSearchedEmpty] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [relinkMode, setRelinkMode] = useState(false);

  if (row.kind === "community") {
    return null;
  }

  const isCohort = row.kind === "cohort";

  const linkState = row.calendarLinkState ?? "unlinked";
  const linked = row.calendarLinkedEvent;
  const linkedSessionCount = linked?.linkedSessionCount ?? 0;

  function cancelRelink() {
    setCandidates(null);
    setRelinkMode(false);
    setSearchedEmpty(false);
    setError(null);
    setMessage(null);
  }

  function search() {
    setError(null);
    setMessage(null);
    setSearchedEmpty(false);
    startTransition(async () => {
      const result = isCohort
        ? await searchCohortCalendarMatches(row.id)
        : await searchPackageInstanceCalendarMatches(row.id);
      if (result.error) {
        setError(result.error);
        setCandidates(null);
        return;
      }
      if (
        result.state === "no_tutor" ||
        result.state === "no_connection" ||
        result.state === "no_student"
      ) {
        setError(
          result.state === "no_tutor"
            ? "Assign a tutor before searching."
            : result.state === "no_student"
              ? "Add a confirmed student before searching."
              : "Tutor has no Google Calendar connection."
        );
        setCandidates(null);
        return;
      }
      setCandidates(result.candidates);
      setSearchedEmpty(result.candidates.length === 0);
    });
  }

  function link(candidate: Candidate) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const linkInput = {
        googleEventId: candidate.googleEventId,
        recurringEventId: candidate.recurringEventId,
        title: candidate.title,
        startsAt: candidate.nextStartsAt,
        endsAt: candidate.nextEndsAt,
      };
      const result = relinkMode
        ? isCohort
          ? await relinkCohortCalendarMatch({ cohortId: row.id, ...linkInput })
          : await relinkPackageInstanceCalendarMatch({
              packageInstanceId: row.id,
              ...linkInput,
            })
        : isCohort
          ? await linkCohortCalendarMatch({ cohortId: row.id, ...linkInput })
          : await linkPackageInstanceCalendarMatch({
              packageInstanceId: row.id,
              ...linkInput,
            });
      if (result.error) {
        setError(result.error);
        return;
      }
      setCandidates(null);
      setSearchedEmpty(false);
      setRelinkMode(false);
      setConfirmUnlink(false);
      setMessage(result.success ?? "Done.");
      onLinked();
    });
  }

  function refreshSessions() {
    if (isCohort) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await refreshPackageInstanceCalendarMatch(row.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.success ?? "Sessions refreshed.");
      onLinked();
    });
  }

  function unlink() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = isCohort
        ? await unlinkCohortCalendarMatch(row.id)
        : await unlinkPackageInstanceCalendarMatch(row.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setConfirmUnlink(false);
      setRelinkMode(false);
      setCandidates(null);
      setMessage(result.success ?? "Unlinked.");
      onLinked();
    });
  }

  if (linkState === "linked" && linked) {
    // Change-event mode: hide the active "synced" display immediately for clarity.
    // DB unlink only runs when a replacement is confirmed — cancel leaves the link intact.
    if (relinkMode) {
      return (
        <div className="min-w-0 space-y-1.5">
          <div className="space-y-0.5 rounded-lg border border-dashed border-amber-200 bg-amber-50/70 p-2">
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
              Choosing replacement
            </span>
            <p className="text-[10px] font-medium text-amber-950">
              Current link is held until you pick a new event. Cancel keeps{" "}
              <span className="line-through opacity-70">{linked.title}</span>.
            </p>
          </div>

          <button
            type="button"
            disabled={pending}
            onClick={cancelRelink}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancel change
          </button>

          {error ? <p className="text-[10px] text-red-600">{error}</p> : null}

          {pending && !candidates && !searchedEmpty ? (
            <p className="text-[10px] text-zinc-500">Searching calendar…</p>
          ) : null}

          {candidates && candidates.length > 0 ? (
            <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2">
              <li className="px-1 text-[10px] font-medium text-zinc-500">
                Confirm a new event to clear the old series and link this one.
              </li>
              {candidates.map((candidate) => (
                <li
                  key={candidate.recurringEventId}
                  className="rounded-md bg-white p-2 shadow-sm"
                >
                  <p className="text-[11px] font-semibold text-zinc-900">{candidate.title}</p>
                  <p className="text-[10px] text-zinc-500">{candidate.timeLabel}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-400">
                    {candidate.reasons.join(" · ")}
                  </p>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => link(candidate)}
                    className="mt-1 text-[11px] font-semibold text-violet-600 hover:text-violet-500 disabled:opacity-50"
                  >
                    {candidate.recurringEventId === linked.recurringEventId
                      ? "Keep / re-confirm this event"
                      : "Use this event instead"}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {searchedEmpty ? (
            <div className="space-y-1">
              <p className="text-[10px] text-amber-800">
                No matching event found — try again or cancel.
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={search}
                className="text-[11px] font-semibold text-violet-600 hover:text-violet-500 disabled:opacity-50"
              >
                Search again
              </button>
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div className="min-w-0 space-y-1.5">
        <div className="space-y-0.5">
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
            Event synced
          </span>
          <p
            className="truncate text-[11px] font-medium text-zinc-800"
            title={linked.title}
          >
            {linked.title}
          </p>
          <p className="text-[10px] text-zinc-500">
            Next: {formatSessionWhenUk(linked.startsAt)}
          </p>
          {linkedSessionCount > 0 ? (
            <p className="text-[10px] text-zinc-400">
              {linkedSessionCount} linked session{linkedSessionCount === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>

        {confirmUnlink ? (
          <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2">
            <p className="text-[10px] font-medium text-amber-950">
              This will remove the calendar connection for all{" "}
              {linkedSessionCount || "linked"} session
              {linkedSessionCount === 1 ? "" : "s"} — are you sure? Google Calendar itself
              is not changed.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={pending}
                onClick={unlink}
                className="rounded-md bg-amber-800 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Unlinking…" : "Yes, unlink"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmUnlink(false)}
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px] font-semibold text-amber-900 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setRelinkMode(true);
                setConfirmUnlink(false);
                search();
              }}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
            >
              {pending ? "Searching…" : "Change event"}
            </button>
            {!isCohort ? (
              <button
                type="button"
                disabled={pending}
                onClick={refreshSessions}
                className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
              >
                {pending ? "Refreshing…" : "Refresh sessions"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setConfirmUnlink(true);
                setRelinkMode(false);
                setCandidates(null);
              }}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
            >
              Unlink
            </button>
          </div>
        )}

        {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
        {message ? <p className="text-[10px] text-emerald-700">{message}</p> : null}
      </div>
    );
  }

  if (linkState === "no_student") {
    return (
      <div className="space-y-1">
        <span className="text-[11px] font-medium text-zinc-500">Add a confirmed student first</span>
        {row.calendarNeedsAttention ? (
          <p className="text-[10px] font-semibold text-amber-700">Needs attention</p>
        ) : null}
      </div>
    );
  }

  if (linkState === "no_tutor") {
    return (
      <div className="space-y-1">
        <span className="text-[11px] font-medium text-zinc-500">Assign a tutor first</span>
        {row.calendarNeedsAttention ? (
          <p className="text-[10px] font-semibold text-amber-700">Needs attention</p>
        ) : null}
      </div>
    );
  }

  if (linkState === "no_connection") {
    return (
      <div className="space-y-1">
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
          Calendar not synced
        </span>
        <p className="text-[10px] text-zinc-500">
          Tutor hasn’t connected Google Calendar yet.
        </p>
        {row.calendarNeedsAttention ? (
          <p className="text-[10px] font-semibold text-amber-700">Needs attention</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="space-y-0.5">
        <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-900">
          Calendar synced
        </span>
        {row.tutorCalendarLastSyncedAt ? (
          <p className="text-[10px] text-zinc-400">
            Last sync{" "}
            {new Date(row.tutorCalendarLastSyncedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
            })}
          </p>
        ) : null}
        <p className="text-[11px] font-medium text-amber-800">
          {searchedEmpty
            ? "No matching event found — try again or link manually"
            : isCohort
              ? "Event not linked for this cohort"
              : "Event not linked for this 1-to-1 run"}
        </p>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={search}
        className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
      >
        {pending ? "Searching…" : searchedEmpty ? "Search again" : "Search for event"}
      </button>

      {row.calendarNeedsAttention ? (
        <p className="text-[10px] font-semibold text-amber-700">Needs attention</p>
      ) : null}

      {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
      {message ? <p className="text-[10px] text-emerald-700">{message}</p> : null}

      {candidates && candidates.length > 0 ? (
        <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2">
          {candidates.map((candidate) => (
            <li key={candidate.recurringEventId} className="rounded-md bg-white p-2 shadow-sm">
              <p className="text-[11px] font-semibold text-zinc-900">{candidate.title}</p>
              <p className="text-[10px] text-zinc-500">{candidate.timeLabel}</p>
              <p className="mt-0.5 text-[10px] text-zinc-400">{candidate.reasons.join(" · ")}</p>
              <button
                type="button"
                disabled={pending}
                onClick={() => link(candidate)}
                className="mt-1 text-[11px] font-semibold text-violet-600 hover:text-violet-500 disabled:opacity-50"
              >
                Link this event
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setCandidates(null);
                setSearchedEmpty(true);
              }}
              className="text-[10px] font-medium text-zinc-500 hover:text-zinc-700"
            >
              Dismiss matches
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
