"use client";

import { fetchAdminTutorHours } from "@/app/admin/tutor-hours/actions";
import {
  addDays,
  startOfWeekMonday,
} from "@/lib/calendar/time-grid-calendar";
import {
  formatWeekRangeLabel,
  formatWeekStartParam,
  parseWeekStartParam,
  type TutorHoursWeekRow,
} from "@/lib/admin/load-admin-tutor-hours";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function formatHours(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function AdminTutorHoursSection() {
  const searchParams = useSearchParams();
  const [weekStart, setWeekStart] = useState(() =>
    formatWeekStartParam(parseWeekStartParam(searchParams.get("week")))
  );
  const [tutors, setTutors] = useState<TutorHoursWeekRow[]>([]);
  const [historicalNote, setHistoricalNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const weekDate = useMemo(() => parseWeekStartParam(weekStart), [weekStart]);
  const rangeLabel = formatWeekRangeLabel(weekDate);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchAdminTutorHours(weekStart).then((result) => {
      if (cancelled) return;
      setTutors(result.tutors);
      setHistoricalNote(result.historicalNote);
      setError(result.error ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [weekStart]);

  function shiftWeek(delta: number) {
    setWeekStart(formatWeekStartParam(addDays(weekDate, delta * 7)));
  }

  const totals = useMemo(() => {
    return tutors.reduce(
      (acc, row) => ({
        lessonHours: acc.lessonHours + row.lessonHours,
        meetingAdminHours: acc.meetingAdminHours + row.meetingAdminHours,
        totalHours: acc.totalHours + row.totalHours,
      }),
      { lessonHours: 0, meetingAdminHours: 0, totalHours: 0 }
    );
  }, [tutors]);

  return (
    <div className={ui.page}>
      <Link
        href="/admin/content"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to Admin home
      </Link>

      <div className="mb-6 mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Tutor hours</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Informational view of upcoming lesson time plus tutor-tagged Kidda meeting, admin, and
            prep. This is not an official pay record.
          </p>
        </div>
        <Link href="/admin/tutor-hours/review" className="text-sm font-medium text-violet-600 hover:text-violet-500">
          Review unmatched events →
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-zinc-900">{rangeLabel}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => shiftWeek(-1)} className={ui.btnSecondary}>
            Previous week
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(formatWeekStartParam(startOfWeekMonday(new Date())))}
            className={ui.btnSecondary}
          >
            This week
          </button>
          <button type="button" onClick={() => shiftWeek(1)} className={ui.btnSecondary}>
            Next week
          </button>
        </div>
      </div>

      {historicalNote ? (
        <p className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {historicalNote}
        </p>
      ) : null}

      {error ? (
        <p className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading tutor hours…</p>
      ) : tutors.length === 0 ? (
        <p className="text-sm text-zinc-500">No tutors found.</p>
      ) : (
        <>
          {!historicalNote ? (
            <div className="mb-6 grid grid-cols-3 gap-3">
              <HoursStat label="Lesson hours" value={totals.lessonHours} />
              <HoursStat label="Meeting / admin" value={totals.meetingAdminHours} />
              <HoursStat label="Total" value={totals.totalHours} />
            </div>
          ) : null}

          <ul className="space-y-3">
            {tutors.map((row) => (
              <li key={row.tutorId} className={ui.cardBordered}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-900">{row.displayName}</p>
                    {row.email ? <p className="text-sm text-zinc-500">{row.email}</p> : null}
                  </div>
                  {historicalNote ? (
                    <p className="text-sm text-zinc-500">Not available for past weeks</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-4 text-right">
                      <HoursCell label="Lessons" value={row.lessonHours} />
                      <HoursCell label="Meeting / admin" value={row.meetingAdminHours} />
                      <HoursCell label="Total" value={row.totalHours} />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function HoursStat({ label, value }: { label: string; value: number }) {
  return (
    <div className={ui.statCard}>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-900">{formatHours(value)}h</p>
    </div>
  );
}

function HoursCell({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-zinc-900">{formatHours(value)}h</p>
    </div>
  );
}
