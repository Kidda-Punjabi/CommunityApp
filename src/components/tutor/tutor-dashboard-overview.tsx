import Link from "next/link";
import type { TutorCohortRow, TutorStudentRow } from "@/lib/tutoring/load-tutor-dashboard";
import { ui } from "@/lib/ui/styles";

function StudentList({
  title,
  students,
  emptyMessage,
}: {
  title: string;
  students: TutorStudentRow[];
  emptyMessage: string;
}) {
  return (
    <section className={ui.section}>
      <h2 className={ui.sectionTitle}>{title}</h2>
      {students.length === 0 ? (
        <p className="text-sm text-zinc-500">{emptyMessage}</p>
      ) : (
        <ul className="space-y-3">
          {students.map((student) => (
            <li key={student.enrollmentId}>
              <Link
                href={`/dashboard/tutor/student/${student.studentId}/${student.courseId}`}
                className={ui.cardInteractive}
              >
                <p className="font-semibold text-zinc-900">{student.studentName}</p>
                <p className="mt-1 text-sm text-zinc-500">{student.courseName} · 1-1</p>
                <p className="mt-2 text-sm font-semibold text-violet-600">
                  Manage lessons →
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CohortList({
  cohorts,
}: {
  cohorts: TutorCohortRow[];
}) {
  return (
    <section className={ui.section}>
      <h2 className={ui.sectionTitle}>Beginners — group classes</h2>
      {cohorts.length === 0 ? (
        <p className="text-sm text-zinc-500">No group cohorts assigned yet.</p>
      ) : (
        <ul className="space-y-3">
          {cohorts.map((cohort) => (
            <li key={cohort.cohortId}>
              <Link
                href={`/dashboard/tutor/cohort/${cohort.cohortId}`}
                className={ui.cardInteractive}
              >
                <p className="font-semibold text-zinc-900">{cohort.cohortName}</p>
                <p className="mt-1 text-sm text-zinc-500">
                  {cohort.courseName} · {cohort.memberCount} student
                  {cohort.memberCount === 1 ? "" : "s"}
                </p>
                {cohort.studentNames.length > 0 && (
                  <p className="mt-2 text-sm text-zinc-600">
                    {cohort.studentNames.slice(0, 4).join(", ")}
                    {cohort.studentNames.length > 4
                      ? ` +${cohort.studentNames.length - 4} more`
                      : ""}
                  </p>
                )}
                <p className="mt-2 text-sm font-semibold text-violet-600">
                  Manage cohort lessons →
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type TutorDashboardOverviewProps = {
  foundationalStudents: TutorStudentRow[];
  beginnersOneToOne: TutorStudentRow[];
  beginnersGroups: TutorCohortRow[];
};

export function TutorDashboardOverview({
  foundationalStudents,
  beginnersOneToOne,
  beginnersGroups,
}: TutorDashboardOverviewProps) {
  const hasAny =
    foundationalStudents.length > 0 ||
    beginnersOneToOne.length > 0 ||
    beginnersGroups.length > 0;

  if (!hasAny) {
    return (
      <div className={ui.emptyState}>
        <span className="text-5xl" role="img" aria-hidden="true">
          👩‍🏫
        </span>
        <p className="mt-4 text-lg font-semibold text-zinc-900">No students yet</p>
        <p className="mt-2 text-sm text-zinc-500">
          Students appear here once they are assigned to you in admin.
        </p>
      </div>
    );
  }

  return (
    <>
      <StudentList
        title="Foundational course"
        students={foundationalStudents}
        emptyMessage="No foundational students assigned yet."
      />
      <StudentList
        title="Beginners — 1-1"
        students={beginnersOneToOne}
        emptyMessage="No 1-1 beginners students assigned yet."
      />
      <CohortList cohorts={beginnersGroups} />
    </>
  );
}
