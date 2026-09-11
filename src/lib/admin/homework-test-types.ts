import type { CourseActor } from "@/lib/kids/course-actor";
import type { HomeworkTextQuestion } from "@/lib/catchup/load-segment-questions";
import type { HomeworkSubmissionView } from "@/lib/tutoring/homework-submissions";

export type HomeworkTestCourse = {
  id: string;
  name: string;
  requiredTier: string | null;
};

export type HomeworkTestLesson = {
  id: string;
  courseId: string;
  lessonNumber: number;
  title: string;
  submissionType: "voice" | "text";
  activityInstructions: string | null;
};

export type HomeworkTestCohort = {
  id: string;
  name: string;
  courseId: string;
  tutorId: string | null;
  tutorLabel: string | null;
};

export type HomeworkTestStudent = {
  key: string;
  studentId: string | null;
  kidProfileId: string | null;
  displayName: string;
  email: string | null;
  studentPackageId: string | null;
  packageLabel: string | null;
};

export type HomeworkTestPreview = {
  lesson: HomeworkTestLesson;
  student: HomeworkTestStudent;
  cohort: HomeworkTestCohort;
  questions: HomeworkTextQuestion[];
  submission: HomeworkSubmissionView | null;
  taskDescription: string;
};

export function homeworkTestStudentKey(input: {
  studentId: string | null;
  kidProfileId: string | null;
}): string {
  if (input.kidProfileId) return `kid:${input.kidProfileId}`;
  return `user:${input.studentId ?? ""}`;
}

export function pickDefaultHomeworkTestCourseId(
  courses: HomeworkTestCourse[]
): string {
  const exact = courses.find(
    (course) => course.name.trim().toLowerCase() === "beginners course"
  );
  if (exact) return exact.id;

  const fuzzy = courses.find((course) => {
    const name = course.name.toLowerCase();
    return name.includes("beginner") && !name.includes("kids");
  });
  return fuzzy?.id ?? courses[0]?.id ?? "";
}

export function filterHomeworkTestStudents(
  students: HomeworkTestStudent[],
  query: string
): HomeworkTestStudent[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return students;
  return students.filter((student) => {
    const haystack = [student.displayName, student.email, student.packageLabel]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export function homeworkTestLessonLabel(lesson: HomeworkTestLesson): string {
  return `Week ${lesson.lessonNumber} · ${lesson.title} (${lesson.submissionType})`;
}

export function courseActorFromHomeworkTestStudent(
  student: HomeworkTestStudent
): CourseActor {
  if (student.kidProfileId) {
    return {
      kind: "kid",
      userId: student.studentId ?? student.kidProfileId,
      kidProfileId: student.kidProfileId,
    };
  }
  if (!student.studentId) {
    throw new Error("Student is missing an account id.");
  }
  return { kind: "user", userId: student.studentId, kidProfileId: null };
}
