export type HomeworkPackageKind = "cohort" | "one_to_one";

export type HomeworkPackageRef =
  | { kind: "cohort"; id: string }
  | { kind: "instance"; id: string }
  | { kind: "enrollment"; id: string };

export type HomeworkPackageStudent = {
  studentId: string;
  studentName: string;
};

export type HomeworkPackageLesson = {
  id: string;
  lessonNumber: number;
  title: string;
  weekLabel: string;
};

export type HomeworkReviewPackage = {
  id: string;
  kind: HomeworkPackageKind;
  name: string;
  courseId: string;
  courseName: string;
  students: HomeworkPackageStudent[];
  lessons: HomeworkPackageLesson[];
};

export type HomeworkPackageEnrollment = {
  enrollmentId: string;
  userId: string;
  kidProfileId: string | null;
  courseId: string;
  courseName: string;
  deliveryMode: string | null;
  cohortId: string | null;
  packageInstanceId: string | null;
  packageInstanceName: string | null;
  actorName: string;
};

export type HomeworkPendingAssignment = {
  submissionId: string;
  packageId: string;
  lessonId: string;
  studentId: string;
};

import type { PendingHomeworkReviewRow } from "@/lib/tutoring/homework-submissions";

export type HomeworkBoardPendingRow = PendingHomeworkReviewRow & {
  packageId: string;
};

export function encodeHomeworkPackageId(ref: HomeworkPackageRef): string {
  return `${ref.kind}:${ref.id}`;
}

export function parseHomeworkPackageId(value: string): HomeworkPackageRef | null {
  const separator = value.indexOf(":");
  if (separator <= 0) return null;
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1).trim();
  if (!id) return null;
  if (kind === "cohort" || kind === "instance" || kind === "enrollment") {
    return { kind, id };
  }
  return null;
}

export function homeworkEnrollmentActorId(row: HomeworkPackageEnrollment): string {
  return row.kidProfileId ?? row.userId;
}

export function isGroupCohortEnrollment(row: HomeworkPackageEnrollment): boolean {
  return row.deliveryMode === "group" && Boolean(row.cohortId);
}

export function homeworkLessonWeekLabel(lessonNumber: number, title: string): string {
  const match = title.match(/\bweek\s+(\d+)\b/i);
  if (match) return `Week ${match[1]}`;
  return `Week ${lessonNumber}`;
}

export function homeworkReviewedKey(actorId: string, lessonId: string): string {
  return `${actorId}:${lessonId}`;
}

export function actorCourseKey(actorId: string, courseId: string): string {
  return `${actorId}:${courseId}`;
}

function uniqueStudents(rows: HomeworkPackageStudent[]): HomeworkPackageStudent[] {
  const seen = new Set<string>();
  const students: HomeworkPackageStudent[] = [];
  for (const row of rows) {
    if (seen.has(row.studentId)) continue;
    seen.add(row.studentId);
    students.push(row);
  }
  return students.sort((a, b) => a.studentName.localeCompare(b.studentName));
}

export function occupiedActorCourseKeysFromCohorts(
  packages: Array<{ courseId: string; students: HomeworkPackageStudent[] }>
): Set<string> {
  const keys = new Set<string>();
  for (const pack of packages) {
    for (const student of pack.students) {
      keys.add(actorCourseKey(student.studentId, pack.courseId));
    }
  }
  return keys;
}

/**
 * Group 1-1 enrollments into homework packages.
 *
 * Live schema: private multi-student 1-1 is a `package_instances` row. Students
 * only share a roster when `student_packages.package_instance_id` is actually
 * set. Unlinked 1-1 enrollments stay one package each — never merge by
 * tutor + course.
 */
export function buildOneToOneHomeworkPackages(
  enrollments: HomeworkPackageEnrollment[],
  occupiedActorCourseKeys: Set<string>
): Array<Omit<HomeworkReviewPackage, "lessons">> {
  const packages: Array<Omit<HomeworkReviewPackage, "lessons">> = [];
  const instanceGroups = new Map<string, HomeworkPackageEnrollment[]>();

  for (const enrollment of enrollments) {
    if (isGroupCohortEnrollment(enrollment)) continue;
    const actorId = homeworkEnrollmentActorId(enrollment);
    if (occupiedActorCourseKeys.has(actorCourseKey(actorId, enrollment.courseId))) {
      continue;
    }

    if (enrollment.packageInstanceId) {
      const list = instanceGroups.get(enrollment.packageInstanceId) ?? [];
      list.push(enrollment);
      instanceGroups.set(enrollment.packageInstanceId, list);
      continue;
    }

    packages.push({
      id: encodeHomeworkPackageId({ kind: "enrollment", id: enrollment.enrollmentId }),
      kind: "one_to_one",
      name: enrollment.actorName,
      courseId: enrollment.courseId,
      courseName: enrollment.courseName,
      students: [{ studentId: actorId, studentName: enrollment.actorName }],
    });
  }

  for (const [instanceId, rows] of instanceGroups) {
    const first = rows[0];
    if (!first) continue;
    const students = uniqueStudents(
      rows.map((row) => ({
        studentId: homeworkEnrollmentActorId(row),
        studentName: row.actorName,
      }))
    );
    if (students.length === 0) continue;
    packages.push({
      id: encodeHomeworkPackageId({ kind: "instance", id: instanceId }),
      kind: "one_to_one",
      name: first.packageInstanceName?.trim() || students.map((row) => row.studentName).join(", "),
      courseId: first.courseId,
      courseName: first.courseName,
      students,
    });
  }

  return packages;
}

export function assignPendingToPackages(
  packages: Array<{
    id: string;
    students: Array<{ studentId: string }>;
    lessons: Array<{ id: string }>;
  }>,
  pending: Array<{ id: string; studentId: string; lessonId: string }>
): HomeworkPendingAssignment[] {
  const indexed = packages.map((pack) => ({
    id: pack.id,
    studentIds: new Set(pack.students.map((student) => student.studentId)),
    lessonIds: new Set(pack.lessons.map((lesson) => lesson.id)),
  }));

  const assigned: HomeworkPendingAssignment[] = [];
  const seen = new Set<string>();

  for (const row of pending) {
    if (seen.has(row.id)) continue;
    const pack = indexed.find(
      (candidate) =>
        candidate.studentIds.has(row.studentId) && candidate.lessonIds.has(row.lessonId)
    );
    if (!pack) continue;
    seen.add(row.id);
    assigned.push({
      submissionId: row.id,
      packageId: pack.id,
      lessonId: row.lessonId,
      studentId: row.studentId,
    });
  }

  return assigned;
}

export function countPendingFromAssignments(assignments: HomeworkPendingAssignment[]): {
  global: number;
  byPackage: Record<string, number>;
  byLesson: Record<string, number>;
} {
  const byPackage: Record<string, number> = {};
  const byLesson: Record<string, number> = {};
  for (const row of assignments) {
    byPackage[row.packageId] = (byPackage[row.packageId] ?? 0) + 1;
    const lessonKey = `${row.packageId}:${row.lessonId}`;
    byLesson[lessonKey] = (byLesson[lessonKey] ?? 0) + 1;
  }
  return {
    global: assignments.length,
    byPackage,
    byLesson,
  };
}

export function pendingBadgeLabel(count: number): string {
  if (count <= 0) return "up to date";
  return `${count} to review`;
}
