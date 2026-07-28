import { CalendarCheck, Notebook } from "lucide-react";
import type { StudentCohortCourseStats } from "@/lib/lessons/load-student-cohort-course-stats";

type CourseCohortStatsProps = {
  stats: StudentCohortCourseStats;
};

export function CourseCohortStats({ stats }: CourseCohortStatsProps) {
  return (
    <div
      className="flex shrink-0 items-center gap-3 text-xs text-zinc-500"
      aria-label={`Attendance ${stats.attendancePercent} percent, homework ${stats.homeworkPercent} percent`}
    >
      <span
        className="inline-flex items-center gap-1"
        title={`Attendance ${stats.attendedCount} of ${stats.availableLessons} available lessons`}
      >
        <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.75} />
        <span>{stats.attendancePercent}%</span>
      </span>
      <span
        className="inline-flex items-center gap-1"
        title={`Homework ${stats.homeworkCompletedCount} of ${stats.availableLessons} available lessons`}
      >
        <Notebook className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.75} />
        <span>{stats.homeworkPercent}%</span>
      </span>
    </div>
  );
}
