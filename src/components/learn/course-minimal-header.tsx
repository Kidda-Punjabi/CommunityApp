import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { BackLink } from "@/components/navigation/back-link";

type CourseMinimalHeaderProps = {
  title: string;
  /** Only shown when it says something unusual, e.g. "Paused". */
  statusLabel?: string | null;
  statusClassName?: string;
  /** "Cohort 44 · Week 9 of 12" */
  metaLine?: string | null;
  backHref?: string;
  /** The button in the top right, e.g. the cohort leaderboard. */
  children?: ReactNode;
};

/** Course page header: back on the left, title in the centre, one button on the right. */
export function CourseMinimalHeader({
  title,
  statusLabel = null,
  statusClassName = "bg-emerald-100 text-emerald-800",
  metaLine = null,
  backHref = "/dashboard/learn",
  children,
}: CourseMinimalHeaderProps) {
  return (
    <div className="mb-5 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
      <BackLink
        fallbackHref={backHref}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-900 hover:text-zinc-900"
      >
        <ChevronLeft className="h-5 w-5" aria-label="Back" />
      </BackLink>
      <div className="min-w-0 text-center">
        <h1 className="truncate font-heading text-xl font-extrabold leading-tight tracking-tight text-zinc-900">{title}</h1>
        {metaLine ? <p className="mt-0.5 truncate text-xs font-bold text-zinc-600">{metaLine}</p> : null}
        {statusLabel ? (
          <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusClassName}`}>{statusLabel}</span>
        ) : null}
      </div>
      <div className="flex justify-end">{children}</div>
    </div>
  );
}
