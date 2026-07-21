"use client";

import { useMemo, useState, useTransition } from "react";
import {
  assignPackageTutorInline,
  resetPackageTutorToNotion,
} from "@/app/admin/packages/actions";
import type { AdminPackageKind, AdminPackageListRow } from "@/lib/admin/packages/types";
import { PackageCalendarCell } from "@/components/admin/packages/package-calendar-cell";

type TutorOption = { id: string; name: string };

type PackageTutorCellProps = {
  row: AdminPackageListRow;
  tutors: TutorOption[];
  onUpdated: (patch: {
    tutorId: string | null;
    tutorName: string | null;
    tutorIdSource: "notion" | "manual";
  }) => void;
  onCalendarLinked?: () => void;
};

export function PackageTutorCell({ row, tutors, onUpdated, onCalendarLinked }: PackageTutorCellProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => {
    const map = new Map(tutors.map((t) => [t.id, t]));
    if (row.tutorId && row.tutorName && !map.has(row.tutorId)) {
      map.set(row.tutorId, { id: row.tutorId, name: row.tutorName });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [tutors, row.tutorId, row.tutorName]);

  if (row.kind === "community") {
    return <span className="text-zinc-400">—</span>;
  }

  function assign(tutorId: string) {
    setError(null);
    const nextId = tutorId || null;
    const nextName = nextId ? (options.find((t) => t.id === nextId)?.name ?? null) : null;
    startTransition(async () => {
      const result = await assignPackageTutorInline(row.kind, row.id, nextId);
      if (result.error) {
        setError(result.error);
        return;
      }
      onUpdated({
        tutorId: nextId,
        tutorName: nextName,
        tutorIdSource: "manual",
      });
    });
  }

  function resetToNotion() {
    setError(null);
    startTransition(async () => {
      const result = await resetPackageTutorToNotion(row.kind as Exclude<AdminPackageKind, "community">, row.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      onUpdated({
        tutorId: result.tutorId ?? null,
        tutorName: result.tutorName ?? null,
        tutorIdSource: "notion",
      });
    });
  }

  return (
    <div className="min-w-[9rem] space-y-1">
      <select
        value={row.tutorId ?? ""}
        disabled={pending}
        onChange={(event) => assign(event.target.value)}
        className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-800 disabled:opacity-60"
      >
        <option value="">Unassigned</option>
        {options.map((tutor) => (
          <option key={tutor.id} value={tutor.id}>
            {tutor.name}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-2">
        {row.tutorIdSource === "manual" ? (
          <>
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              Manual
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={resetToNotion}
              className="text-[10px] font-semibold text-violet-600 hover:text-violet-500 disabled:opacity-50"
            >
              Reset to Notion
            </button>
          </>
        ) : (
          <span className="text-[10px] text-zinc-400">Notion</span>
        )}
      </div>
      {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
      {row.kind === "cohort" && onCalendarLinked ? (
        <div className="border-t border-zinc-100 pt-2">
          <PackageCalendarCell row={row} onLinked={onCalendarLinked} />
        </div>
      ) : null}
    </div>
  );
}
