"use client";

import { formatLessonProgressLabel } from "@/lib/lessons/lesson-log-progress";
import type { AdminPackageListRow } from "@/lib/admin/packages/types";
import { useState } from "react";

type PackageLessonProgressCellProps = {
  row: AdminPackageListRow;
};

export function PackageLessonProgressCell({ row }: PackageLessonProgressCellProps) {
  const [open, setOpen] = useState(false);

  if (row.kind !== "cohort" || row.lessonLogCompleted == null || row.lessonLogTotal == null) {
    return <span className="text-zinc-400">—</span>;
  }

  const label = formatLessonProgressLabel({
    completedCount: row.lessonLogCompleted,
    totalLessons: row.lessonLogTotal,
    nextLessonAt: row.lessonLogNextAt,
  });

  if (row.lessonLogEntries.length === 0) {
    return <span title="No Lessons Log entries synced yet">{label}</span>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-left text-sm font-medium text-violet-700 hover:text-violet-600"
        aria-expanded={open}
      >
        {label}
      </button>
      {open ? (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-zinc-600">
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
