import { KidLucideIcon } from "@/components/kids/kid-lucide-icon";
import { NavLink } from "@/components/ui/nav-link";
import type { ParentKidProgressSummary } from "@/lib/kids/load-kid-progress-summary";
import { pressableClass } from "@/lib/ui/pressable";
import { cn, ui } from "@/lib/ui/styles";
import { CalendarCheck, MessageSquareText, Notebook } from "lucide-react";

function formatDue(value: string | null): string | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}

export function ParentKidsProgressList({
  rows,
}: {
  rows: ParentKidProgressSummary[];
}) {
  if (rows.length === 0) {
    return (
      <div className={ui.emptyState}>
        <p className="font-heading text-base font-semibold text-zinc-900">No kid profiles yet</p>
        <p className="mt-1 text-sm text-zinc-500">Add a child from Profile to see their progress here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const href = `/dashboard/learn/kids-progress/${row.kidProfileId}`;
        const dueLabel = formatDue(row.outstandingHomeworkDueAt);

        return (
          <NavLink
            key={row.kidProfileId}
            href={href}
            className={cn(pressableClass, ui.cardBordered, "block hover:border-violet-200")}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-100">
                <KidLucideIcon name={row.avatarIcon} className="h-7 w-7 text-sky-600" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-base font-semibold text-zinc-900">{row.kidName}</p>
                {row.courseName ? (
                  <>
                    <p className="mt-0.5 text-sm text-zinc-600">{row.courseName}</p>
                    {row.courseLevel && row.courseLevel !== "private" ? (
                      <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-zinc-400">
                        {row.courseLevel}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
                      <span className="inline-flex items-center gap-1">
                        <CalendarCheck className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                        {row.attendanceTotal > 0
                          ? `Attendance ${row.attendancePresent}/${row.attendanceTotal}`
                          : "No attendance yet"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Notebook className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                        {row.outstandingHomeworkTitle
                          ? `Due${dueLabel ? ` ${dueLabel}` : ""}: ${row.outstandingHomeworkTitle}`
                          : "No outstanding homework"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquareText className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                        {row.latestTutorNote ? "Latest tutor note" : "No notes yet"}
                      </span>
                    </div>
                    {row.latestTutorNote ? (
                      <p className="mt-2 line-clamp-2 text-xs text-zinc-500">{row.latestTutorNote}</p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-0.5 text-sm text-zinc-500">Not enrolled yet</p>
                )}
              </div>
            </div>
          </NavLink>
        );
      })}
    </div>
  );
}
