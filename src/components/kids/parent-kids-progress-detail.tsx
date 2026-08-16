import { KidLucideIcon } from "@/components/kids/kid-lucide-icon";
import type {
  ParentKidAttendanceUiStatus,
  ParentKidCourseProgress,
  ParentKidHomeworkUiStatus,
} from "@/lib/kids/load-parent-course-progress";
import { ui } from "@/lib/ui/styles";

const HOMEWORK_LABEL: Record<ParentKidHomeworkUiStatus, string> = {
  submitted: "Submitted",
  late: "Late",
  missed: "Missed",
  not_due_yet: "Not due yet",
};

const ATTENDANCE_LABEL: Record<ParentKidAttendanceUiStatus, string> = {
  present: "Present",
  absent: "Absent",
  upcoming: "Upcoming",
};

function statusClass(kind: "homework" | "attendance", value: string): string {
  if (kind === "homework") {
    if (value === "submitted") return "bg-emerald-50 text-emerald-800";
    if (value === "late") return "bg-amber-50 text-amber-800";
    if (value === "missed") return "bg-rose-50 text-rose-800";
    return "bg-zinc-100 text-zinc-600";
  }
  if (value === "present") return "bg-emerald-50 text-emerald-800";
  if (value === "absent") return "bg-rose-50 text-rose-800";
  return "bg-zinc-100 text-zinc-600";
}

export function ParentKidsProgressDetail({
  progress,
}: {
  progress: ParentKidCourseProgress;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sky-100">
          <KidLucideIcon
            name={progress.profile.avatar_icon}
            className="h-8 w-8 text-sky-600"
          />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            {progress.profile.name}
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {progress.courses.length === 0
              ? "Not enrolled yet"
              : progress.courses.length === 1
                ? progress.courses[0].courseName
                : `${progress.courses.length} courses`}
          </p>
        </div>
      </div>

      {progress.courses.length === 0 ? (
        <div className={ui.emptyState}>
          <p className="font-heading text-base font-semibold text-zinc-900">
            No course yet
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Homework, attendance, and tutor notes will show here once {progress.profile.name} is
            enrolled.
          </p>
        </div>
      ) : (
        progress.courses.map((course) => (
          <section key={course.courseId}>
            <div className="mb-3">
              <h2 className="font-heading text-lg font-semibold text-zinc-900">
                {course.courseName}
              </h2>
              <p className="mt-0.5 text-sm text-zinc-500">
                Week {course.currentWeek} of {course.totalWeeks}
              </p>
            </div>
            <ol className="space-y-3">
              {course.lessons.map((lesson) => (
                <li key={lesson.lessonId} className={ui.cardBordered}>
                  <p className="font-heading text-sm font-semibold text-zinc-900">
                    Week {lesson.lessonNumber}
                    {lesson.lessonTitle ? (
                      <span className="font-medium text-zinc-500"> · {lesson.lessonTitle}</span>
                    ) : null}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                    <span
                      className={`rounded-full px-2.5 py-1 ${statusClass("homework", lesson.homeworkUiStatus)}`}
                    >
                      Homework: {HOMEWORK_LABEL[lesson.homeworkUiStatus]}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 ${statusClass("attendance", lesson.attendanceUiStatus)}`}
                    >
                      Attendance: {ATTENDANCE_LABEL[lesson.attendanceUiStatus]}
                    </span>
                  </div>
                  {lesson.weekTutorNote ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-600">
                      {lesson.weekTutorNote}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}
