"use client";

import { formatSessionWhenUk } from "@/lib/calendar/uk-display-time";
import type { AdminPackageListRow } from "@/lib/admin/packages/types";
import { useState } from "react";

type PackageLessonProgressCellProps = {
  row: AdminPackageListRow;
};

export function PackageLessonProgressCell({ row }: PackageLessonProgressCellProps) {
  const [open, setOpen] = useState(false);

  if (row.kind !== "cohort" || row.lessonLogCompleted == null || row.lessonLogTotal == null) {
    return <span className="block text-center text-zinc-400">—</span>;
  }

  const fraction = `${row.lessonLogCompleted}/${row.lessonLogTotal || "?"}`;
  const calendarNext = row.calendarLinkedEvent?.startsAt
    ? formatSessionWhenUk(row.calendarLinkedEvent.startsAt)
    : null;
  const syntheticNext = row.lessonLogNextAt
    ? formatSessionWhenUk(row.lessonLogNextAt)
    : null;
  const nextDateLabel = calendarNext ?? syntheticNext;
  const nextTopic = row.lessonLogNextTitle?.trim() || null;

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-sm font-semibold text-violet-700 hover:text-violet-600"
        aria-expanded={open}
        title="Lessons completed (Cancelled excluded)"
      >
        {fraction}
      </button>
      {nextDateLabel ? (
        <p className="text-[11px] leading-snug text-zinc-600">
          <span className="font-medium text-zinc-500">Next:</span> {nextDateLabel}
        </p>
      ) : null}
      {nextTopic ? (
        <p className="max-w-[14rem] text-[11px] leading-snug text-zinc-700">
          <span className="font-medium text-zinc-500">Topic:</span> {nextTopic}
        </p>
      ) : null}
      {open && row.lessonLogEntries.length > 0 ? (
        <ul className="mt-1 max-h-40 w-full space-y-1 overflow-y-auto text-left text-xs text-zinc-600">
          {row.lessonLogEntries.map((entry) => (
            <li key={entry.id}>
              Week {entry.weekNumber} · {entry.lessonDate}
              {entry.lessonTitle ? ` · ${entry.lessonTitle}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
