import { KidLucideIcon } from "@/components/kids/kid-lucide-icon";
import { NavLink } from "@/components/ui/nav-link";
import type { ParentKidCourseProgress } from "@/lib/kids/load-parent-course-progress";
import { pressableClass } from "@/lib/ui/pressable";
import { cn, ui } from "@/lib/ui/styles";
import { CalendarCheck, MessageSquareText, Notebook } from "lucide-react";

function notesLabel(count: number): string {
  if (count <= 0) return "No notes yet";
  return count === 1 ? "1 note" : `${count} notes`;
}

export function ParentKidsProgressList({
  rows,
}: {
  rows: ParentKidCourseProgress[];
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
        const course = row.courses[0] ?? null;
        const href = `/dashboard/learn/kids-progress/${row.profile.id}`;
        const percent =
          course && course.totalWeeks > 0
            ? Math.round((course.currentWeek / course.totalWeeks) * 100)
            : 0;

        return (
          <NavLink
            key={row.profile.id}
            href={href}
            className={cn(pressableClass, ui.cardBordered, "block hover:border-violet-200")}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-100">
                <KidLucideIcon
                  name={row.profile.avatar_icon}
                  className="h-7 w-7 text-sky-600"
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-base font-semibold text-zinc-900">
                  {row.profile.name}
                </p>
                {course ? (
                  <>
                    <p className="mt-0.5 text-sm text-zinc-600">{course.courseName}</p>
                    <p className="mt-1 text-xs font-medium text-zinc-500">
                      Week {course.currentWeek} of {course.totalWeeks}
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-violet-100">
                      <div
                        className="h-full rounded-full bg-violet-600"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
                      <span className="inline-flex items-center gap-1">
                        <Notebook className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                        Homework {course.homeworkDone}/{course.homeworkDue}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarCheck className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                        Attendance {course.attendancePresent}/{course.attendanceDue}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquareText className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                        {notesLabel(course.tutorNoteCount)}
                      </span>
                    </div>
                    {row.courses.length > 1 ? (
                      <p className="mt-2 text-[11px] text-zinc-400">
                        +{row.courses.length - 1} more course
                        {row.courses.length === 2 ? "" : "s"}
                      </p>
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
