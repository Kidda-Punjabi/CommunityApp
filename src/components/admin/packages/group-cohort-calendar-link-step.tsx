"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  fetchTutorWeeklySeriesOccurrences,
  searchTutorWeeklyCalendarSeries,
} from "@/app/admin/packages/actions";
import {
  GROUP_COHORT_SESSION_COUNT,
  hasExactLinkedSessionCount,
  includedOccurrenceCount,
  withAssignedWeekNumbers,
  type GroupCohortOccurrenceWithWeek,
} from "@/lib/admin/packages/group-cohort-calendar-occurrences";
import { formatSessionWhenUk } from "@/lib/calendar/uk-display-time";

export type GroupCohortCalendarLinkValue = {
  recurringEventId: string;
  occurrences: Array<{
    googleEventId: string;
    startsAt: string;
    endsAt: string;
    title: string;
    meetLink: string | null;
    location: string | null;
    attendeeEmails: string[];
    included: boolean;
  }>;
};

type SeriesOption = {
  recurringEventId: string;
  title: string;
  weekday: string;
  timeLabel: string;
  nextStartsAt: string;
  nextEndsAt: string;
  matchesIntendedSlot: boolean;
};

type GroupCohortCalendarLinkStepProps = {
  tutorId: string;
  startDate: string;
  onChange: (value: GroupCohortCalendarLinkValue | null, ready: boolean) => void;
};

export function GroupCohortCalendarLinkStep({
  tutorId,
  startDate,
  onChange,
}: GroupCohortCalendarLinkStepProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [series, setSeries] = useState<SeriesOption[]>([]);
  const [matchingSlotCount, setMatchingSlotCount] = useState(0);
  const [noConnection, setNoConnection] = useState(false);
  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [occurrences, setOccurrences] = useState<GroupCohortOccurrenceWithWeek[]>([]);

  useEffect(() => {
    setSelectedSeriesId("");
    setOccurrences([]);
    setSeries([]);
    setNoConnection(false);
    setError(null);
    onChange(null, false);

    startTransition(async () => {
      const result = await searchTutorWeeklyCalendarSeries(tutorId, startDate || null);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.state === "no_connection") {
        setNoConnection(true);
        return;
      }
      setSeries(result.series);
      setMatchingSlotCount(result.matchingSlotCount ?? 0);
    });
    // onChange is stable enough for this form; avoid retriggering on parent rerenders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorId]);

  useEffect(() => {
    if (!selectedSeriesId || !startDate) {
      setOccurrences([]);
      onChange(null, false);
      return;
    }

    startTransition(async () => {
      const result = await fetchTutorWeeklySeriesOccurrences(
        tutorId,
        selectedSeriesId,
        startDate
      );
      if (result.error) {
        setError(result.error);
        setOccurrences([]);
        onChange(null, false);
        return;
      }
      setError(null);
      setOccurrences(result.occurrences);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorId, selectedSeriesId, startDate]);

  const numbered = useMemo(() => withAssignedWeekNumbers(occurrences), [occurrences]);
  const includedCount = includedOccurrenceCount(numbered);
  const ready = hasExactLinkedSessionCount(numbered);
  const emitSignature = useMemo(
    () =>
      JSON.stringify({
        selectedSeriesId,
        ready,
        occurrences: numbered.map((row) => ({
          googleEventId: row.googleEventId,
          included: row.included,
          startsAt: row.startsAt,
        })),
      }),
    [numbered, ready, selectedSeriesId]
  );

  useEffect(() => {
    if (!selectedSeriesId || numbered.length === 0) {
      onChange(null, false);
      return;
    }
    onChange(
      {
        recurringEventId: selectedSeriesId,
        occurrences: numbered.map((row) => ({
          googleEventId: row.googleEventId,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          title: row.title,
          meetLink: row.meetLink,
          location: row.location,
          attendeeEmails: row.attendeeEmails,
          included: row.included,
        })),
      },
      ready
    );
    // emitSignature captures the payload identity so parent setState does not loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emitSignature]);

  function toggleIncluded(googleEventId: string, included: boolean) {
    setOccurrences((current) =>
      current.map((row) =>
        row.googleEventId === googleEventId ? { ...row, included } : row
      )
    );
  }

  if (noConnection) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        This tutor has not connected Google Calendar. Ask them to connect it on the tutor
        dashboard, then try again.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
      <div>
        <p className="text-sm font-semibold text-zinc-900">Link weekly class calendar</p>
        <p className="mt-1 text-xs text-zinc-600">
          Live from the tutor’s Google Calendar. Pick the recurring weekly class, then include
          or skip each date. Week numbers 1–{GROUP_COHORT_SESSION_COUNT} are assigned only to
          included classes.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {pending && series.length === 0 && !error ? (
        <p className="text-sm text-zinc-500">Loading calendar…</p>
      ) : series.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No weekly recurring events found on this tutor’s calendar.
        </p>
      ) : (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-800">Weekly series</legend>
          {matchingSlotCount > 1 && startDate ? (
            <p className="text-xs text-amber-800">
              More than one weekly series matches this weekday. Pick the real cohort class —
              do not guess.
            </p>
          ) : null}
          <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {series.map((item) => (
              <label
                key={item.recurringEventId}
                className={`flex cursor-pointer items-start gap-2 rounded-xl border bg-white px-3 py-2 text-sm ${
                  selectedSeriesId === item.recurringEventId
                    ? "border-violet-400"
                    : "border-zinc-200"
                }`}
              >
                <input
                  type="radio"
                  name="group-cohort-calendar-series"
                  className="mt-1"
                  checked={selectedSeriesId === item.recurringEventId}
                  onChange={() => setSelectedSeriesId(item.recurringEventId)}
                />
                <span>
                  <span className="font-medium text-zinc-900">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    {item.weekday} · {item.timeLabel}
                    {item.matchesIntendedSlot ? " · matches weekday" : ""}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {selectedSeriesId && !startDate ? (
        <p className="text-sm text-zinc-600">
          Set “First class on or after” to list this series’ dates.
        </p>
      ) : null}

      {selectedSeriesId && startDate && numbered.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-zinc-800">Classes</p>
            <p
              className={`text-xs font-semibold ${
                ready ? "text-emerald-700" : "text-amber-800"
              }`}
            >
              {includedCount} of {GROUP_COHORT_SESSION_COUNT} included
            </p>
          </div>
          {!ready ? (
            <p className="text-xs text-amber-800">
              {includedCount < GROUP_COHORT_SESSION_COUNT
                ? `Need ${GROUP_COHORT_SESSION_COUNT} included classes to create this package. This series has ${numbered.length} date${numbered.length === 1 ? "" : "s"} on or after the start date.`
                : `Skip extra dates until exactly ${GROUP_COHORT_SESSION_COUNT} are included.`}
            </p>
          ) : null}
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {numbered.map((row) => (
              <div
                key={row.googleEventId}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {formatSessionWhenUk(row.startsAt)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {row.included && row.weekNumber != null
                        ? `Week ${row.weekNumber}`
                        : "Skipped — no week number"}
                      {row.status === "cancelled" ? " · cancelled on calendar" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 rounded-full border border-zinc-200 p-0.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => toggleIncluded(row.googleEventId, true)}
                      className={`rounded-full px-2 py-1 ${
                        row.included ? "bg-violet-600 text-white" : "text-zinc-600"
                      }`}
                    >
                      Include
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleIncluded(row.googleEventId, false)}
                      className={`rounded-full px-2 py-1 ${
                        !row.included ? "bg-zinc-700 text-white" : "text-zinc-600"
                      }`}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {selectedSeriesId && startDate && !pending && numbered.length === 0 && !error ? (
        <p className="text-sm text-amber-800">
          No occurrences found on or after this date. The tutor may need to extend the recurring
          invite.
        </p>
      ) : null}

      {pending && selectedSeriesId && startDate ? (
        <p className="text-sm text-zinc-500">Loading dates from Google Calendar…</p>
      ) : null}
    </div>
  );
}
