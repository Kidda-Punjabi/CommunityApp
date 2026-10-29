import type { ReactNode } from "react";

type CourseMinimalHeaderProps = {
  title: string;
  /** e.g. "Active"; shown as a small chip beside the title. */
  statusLabel?: string | null;
  statusClassName?: string;
  /** "Tarn · Cohort 44 · Week 9 of 12" */
  metaLine?: string | null;
  currentWeek?: number | null;
  totalWeeks?: number;
  children?: ReactNode;
};

/**
 * Minimal course page header (Beginners group): title, one meta line and a thin
 * week progress bar. Replaces the package card so the lessons sit near the top.
 */
export function CourseMinimalHeader({
  title,
  statusLabel = null,
  statusClassName = "bg-emerald-100 text-emerald-800",
  metaLine = null,
  currentWeek = null,
  totalWeeks = 0,
  children,
}: CourseMinimalHeaderProps) {
  const showProgress = currentWeek != null && totalWeeks > 0;
  const pct = showProgress
    ? Math.min(100, Math.max(0, Math.round((currentWeek / totalWeeks) * 100)))
    : 0;

  return (
    <div className="mb-6 mt-4 space-y-2.5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
        {statusLabel ? (
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusClassName}`}
          >
            {statusLabel}
          </span>
        ) : null}
      </div>
      {metaLine ? <p className="text-sm text-zinc-500">{metaLine}</p> : null}
      {showProgress ? (
        <div
          role="progressbar"
          aria-label="Course progress"
          aria-valuemin={0}
          aria-valuemax={totalWeeks}
          aria-valuenow={currentWeek}
          aria-valuetext={`Week ${currentWeek} of ${totalWeeks}`}
          className="h-1 overflow-hidden rounded-full bg-zinc-200"
        >
          <div className="h-full rounded-full bg-violet-600" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      {children ? <div className="pt-1.5">{children}</div> : null}
    </div>
  );
}
