"use client";

import { useState, useTransition } from "react";
import {
  linkCohortCalendarMatch,
  searchCohortCalendarMatches,
} from "@/app/admin/packages/actions";
import type { AdminPackageListRow } from "@/lib/admin/packages/types";

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

import {
  formatSessionWhenUk,
} from "@/lib/calendar/uk-display-time";

export function PackageCalendarCell({ row, onLinked }: PackageCalendarCellProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [searchedEmpty, setSearchedEmpty] = useState(false);

  if (row.kind !== "cohort") {
    return null;
  }

  const linkState = row.calendarLinkState ?? "unlinked";

  if (linkState === "linked" && row.calendarLinkedEvent) {
    return (
      <div className="min-w-[11rem] space-y-0.5">
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
          Event synced
        </span>
        <p className="truncate text-[11px] font-medium text-zinc-800" title={row.calendarLinkedEvent.title}>
          {row.calendarLinkedEvent.title}
        </p>
        <p className="text-[10px] text-zinc-500">
          Next: {formatSessionWhenUk(row.calendarLinkedEvent.startsAt)}
        </p>
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

  function search() {
    setError(null);
    setSearchedEmpty(false);
    startTransition(async () => {
      const result = await searchCohortCalendarMatches(row.id);
      if (result.error) {
        setError(result.error);
        setCandidates(null);
        return;
      }
      if (result.state === "no_tutor" || result.state === "no_connection") {
        setError(
          result.state === "no_tutor"
            ? "Assign a tutor before searching."
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
    startTransition(async () => {
      const result = await linkCohortCalendarMatch({
        cohortId: row.id,
        googleEventId: candidate.googleEventId,
        recurringEventId: candidate.recurringEventId,
        title: candidate.title,
        startsAt: candidate.nextStartsAt,
        endsAt: candidate.nextEndsAt,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setCandidates(null);
      setSearchedEmpty(false);
      onLinked();
    });
  }

  // Connected calendar, but this cohort has no recurring event linked yet.
  return (
    <div className="min-w-[11rem] space-y-1.5">
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
            : "Event not linked for this cohort"}
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
