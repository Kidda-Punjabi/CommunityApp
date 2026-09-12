import { KidLucideIcon } from "@/components/kids/kid-lucide-icon";
import type { ParentKidProgressSummary } from "@/lib/kids/load-kid-progress-summary";
import { pressableClass } from "@/lib/ui/pressable";
import { cn } from "@/lib/ui/styles";
import { ChevronRight, ClipboardList } from "lucide-react";
import { NavLink } from "@/components/ui/nav-link";

function attendanceLabel(row: ParentKidProgressSummary): string {
  if (row.attendanceTotal <= 0) return "No attendance yet";
  return `${row.attendancePresent}/${row.attendanceTotal} attended`;
}

export function LearnKidsProgressLink({
  summaries = [],
}: {
  summaries?: ParentKidProgressSummary[];
}) {
  return (
    <NavLink
      href="/dashboard/learn/kids-progress"
      className={cn(
        pressableClass,
        "flex items-start gap-3 rounded-2xl bg-emerald-100 px-3.5 py-3.5 text-emerald-950 shadow-[0_1px_8px_-4px_rgba(16,185,129,0.18)] hover:bg-emerald-50"
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-700">
        <ClipboardList className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-sm font-semibold text-emerald-950">
          Check how your kids are doing
        </span>
        {summaries.length === 0 ? (
          <span className="mt-0.5 block text-[11px] font-medium text-emerald-800/80">
            Homework, attendance, and tutor notes
          </span>
        ) : (
          <span className="mt-1.5 block space-y-1.5">
            {summaries.map((row) => (
              <span key={row.kidProfileId} className="flex items-center gap-2 text-[11px] font-medium text-emerald-900/85">
                <KidLucideIcon name={row.avatarIcon} className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 truncate">
                  {row.kidName}
                  {row.courseName ? ` · ${row.courseName}` : " · Not enrolled yet"}
                  {" · "}
                  {attendanceLabel(row)}
                </span>
              </span>
            ))}
          </span>
        )}
      </span>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
    </NavLink>
  );
}
