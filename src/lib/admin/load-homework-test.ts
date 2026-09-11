import "server-only";

import {
  courseActorFromHomeworkTestStudent,
  homeworkTaskDescription,
  homeworkTestStudentKey,
  type HomeworkTestCohort,
  type HomeworkTestCourse,
  type HomeworkTestLesson,
  type HomeworkTestLessonView,
  type HomeworkTestPreview,
  type HomeworkTestStudent,
} from "@/lib/admin/homework-test-types";
import { getStaffFacingName, resolveStudentLabel } from "@/lib/profile/display-name";
import { loadHomeworkQuestionsForLesson, loadHomeworkSegmentForLesson } from "@/lib/tutoring/homework-questions";
import { fetchFormalHomeworkForActor } from "@/lib/tutoring/homework-submissions";
import type { SupabaseClient } from "@supabase/supabase-js";

const HOMEWORK_COURSE_TIERS = new Set(["foundational", "beginners"]);

type LessonSegmentRow = {
  lesson_id: string;
  homework_submission_type: string | null;
  activity_instructions: string | null;
  sort_order: number | null;
};

export async function loadHomeworkTestCourses(
  supabase: SupabaseClient
): Promise<HomeworkTestCourse[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, required_tier, display_order")
    .order("display_order", { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .filter((row) => HOMEWORK_COURSE_TIERS.has(String(row.required_tier ?? "")))
    .map((row) => ({
      id: row.id as string,
      name: (row.name as string) ?? "Course",
      requiredTier: (row.required_tier as string | null) ?? null,
    }));
}

export async function loadHomeworkTestLessons(
  supabase: SupabaseClient,
  courseId: string
): Promise<HomeworkTestLesson[]> {
  const { data: lessons, error: lessonError } = await supabase
    .from("lessons")
    .select("id, course_id, lesson_number, title")
    .eq("course_id", courseId)
    .order("lesson_number", { ascending: true });

  if (lessonError) throw lessonError;
  const lessonRows = lessons ?? [];
  if (lessonRows.length === 0) return [];

  const lessonIds = lessonRows.map((row) => row.id as string);
  const { data: segments, error: segmentError } = await supabase
    .from("lesson_segments")
    .select("lesson_id, homework_submission_type, activity_instructions, sort_order")
    .eq("activity_type", "homework")
    .in("lesson_id", lessonIds)
    .order("sort_order", { ascending: false });

  if (segmentError) throw segmentError;

  const segmentByLesson = new Map<string, LessonSegmentRow>();
  for (const row of (segments ?? []) as LessonSegmentRow[]) {
    if (!segmentByLesson.has(row.lesson_id)) {
      segmentByLesson.set(row.lesson_id, row);
    }
  }

  return lessonRows.flatMap((lesson) => {
    const segment = segmentByLesson.get(lesson.id as string);
    if (!segment) return [];
    return [
      {
        id: lesson.id as string,
        courseId: lesson.course_id as string,
        lessonNumber: Number(lesson.lesson_number) || 0,
        title: (lesson.title as string) ?? "Lesson",
        submissionType: segment.homework_submission_type === "text" ? "text" : "voice",
        activityInstructions: segment.activity_instructions,
      } satisfies HomeworkTestLesson,
    ];
  });
}

export async function loadHomeworkTestCohorts(
  supabase: SupabaseClient,
  courseId: string
): Promise<HomeworkTestCohort[]> {
  const { data: cohorts, error } = await supabase
    .from("cohorts")
    .select("id, name, course_id, tutor_id")
    .eq("course_id", courseId)
    .order("name", { ascending: true });

  if (error) throw error;

  const tutorIds = [
    ...new Set(
      (cohorts ?? [])
        .map((row) => row.tutor_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const tutorNameById = new Map<string, string>();
  if (tutorIds.length > 0) {
    const { data: tutors } = await supabase
      .from("profiles")
      .select("id, full_name, preferred_name")
      .in("id", tutorIds);
    for (const tutor of tutors ?? []) {
      tutorNameById.set(
        tutor.id as string,
        getStaffFacingName(tutor) ?? "Tutor"
      );
    }
  }

  return (cohorts ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as string) ?? "Cohort",
    courseId: row.course_id as string,
    tutorId: (row.tutor_id as string | null) ?? null,
    tutorLabel: row.tutor_id
      ? tutorNameById.get(row.tutor_id as string) ?? "Tutor"
      : null,
  }));
}

export async function loadHomeworkTestStudents(
  supabase: SupabaseClient,
  cohortId: string
): Promise<HomeworkTestStudent[]> {
  const { data: members, error } = await supabase
    .from("cohort_members")
    .select("user_id, kid_profile_id")
    .eq("cohort_id", cohortId)
    .is("left_at", null);

  if (error) throw error;

  const userIds = [
    ...new Set(
      (members ?? [])
        .map((row) => row.user_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const kidIds = [
    ...new Set(
      (members ?? [])
        .map((row) => row.kid_profile_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const [{ data: profiles }, { data: kids }, { data: enrollments }, { data: cohort }] =
    await Promise.all([
    userIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, preferred_name")
          .in("id", userIds)
      : Promise.resolve({ data: [] }),
    kidIds.length > 0
      ? supabase
          .from("kid_profiles")
          .select("id, name, parent_user_id")
          .in("id", kidIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("course_enrollments")
      .select("user_id, kid_profile_id, student_package_id")
      .eq("cohort_id", cohortId),
    supabase.from("cohorts").select("course_id").eq("id", cohortId).maybeSingle(),
  ]);

  const profileById = new Map(
    (profiles ?? []).map((row) => [row.id as string, row] as const)
  );
  const kidById = new Map(
    (kids ?? []).map((row) => [row.id as string, row] as const)
  );

  const packageIdByActor = new Map<string, string>();
  for (const row of enrollments ?? []) {
    const packageId = row.student_package_id as string | null;
    if (!packageId) continue;
    if (row.kid_profile_id) {
      packageIdByActor.set(`kid:${row.kid_profile_id}`, packageId);
    } else if (row.user_id) {
      packageIdByActor.set(`user:${row.user_id}`, packageId);
    }
  }

  const packageIds = [...new Set(packageIdByActor.values())];
  const courseId = (cohort?.course_id as string | null) ?? null;

  type PackageLookupRow = {
    id: string;
    status: string | null;
    user_id: string | null;
    kid_profile_id: string | null;
    packages:
      | { name?: string; course_id?: string; delivery_mode?: string }
      | { name?: string; course_id?: string; delivery_mode?: string }[]
      | null;
  };

  const extraPackageRows: PackageLookupRow[] = [];
  if (userIds.length > 0) {
    const { data } = await supabase
      .from("student_packages")
      .select("id, status, user_id, kid_profile_id, packages(name, course_id, delivery_mode)")
      .in("user_id", userIds);
    extraPackageRows.push(...((data ?? []) as PackageLookupRow[]));
  }
  if (kidIds.length > 0) {
    const { data } = await supabase
      .from("student_packages")
      .select("id, status, user_id, kid_profile_id, packages(name, course_id, delivery_mode)")
      .in("kid_profile_id", kidIds);
    extraPackageRows.push(...((data ?? []) as PackageLookupRow[]));
  }

  function packageMeta(row: PackageLookupRow) {
    const pkg = Array.isArray(row.packages) ? row.packages[0] : row.packages;
    return {
      name: pkg?.name ?? "Package",
      courseId: pkg?.course_id ?? null,
      deliveryMode: pkg?.delivery_mode ?? null,
    };
  }

  for (const row of extraPackageRows) {
    const meta = packageMeta(row);
    if (courseId && meta.courseId && meta.courseId !== courseId) continue;
    const key = homeworkTestStudentKey({
      studentId: (row.user_id as string | null) ?? null,
      kidProfileId: (row.kid_profile_id as string | null) ?? null,
    });
    const existing = packageIdByActor.get(key);
    if (existing && meta.deliveryMode !== "group") continue;
    if (!existing || meta.deliveryMode === "group") {
      packageIdByActor.set(key, row.id);
    }
  }

  const allPackageIds = [...new Set([...packageIds, ...packageIdByActor.values()])];
  const packageLabelById = new Map<string, string>();
  if (allPackageIds.length > 0) {
    const { data: packages } = await supabase
      .from("student_packages")
      .select("id, status, packages(name)")
      .in("id", allPackageIds);
    for (const row of packages ?? []) {
      const pkg = Array.isArray(row.packages) ? row.packages[0] : row.packages;
      const name = (pkg as { name?: string } | null)?.name ?? "Package";
      const status = (row.status as string | null)?.replace(/_/g, " ") ?? "unknown";
      packageLabelById.set(row.id as string, `${name} · ${status}`);
    }
  }

  return (members ?? [])
    .map((row) => {
      const kidProfileId = (row.kid_profile_id as string | null) ?? null;
      const studentId = kidProfileId
        ? ((kidById.get(kidProfileId)?.parent_user_id as string | null) ??
          (row.user_id as string | null) ??
          null)
        : ((row.user_id as string | null) ?? null);
      const key = homeworkTestStudentKey({ studentId, kidProfileId });
      const profile = studentId ? profileById.get(studentId) : null;
      const kid = kidProfileId ? kidById.get(kidProfileId) : null;
      const studentPackageId = packageIdByActor.get(key) ?? null;

      return {
        key,
        studentId,
        kidProfileId,
        displayName: resolveStudentLabel(
          kid ? ((kid.name as string | null) ?? null) : null,
          getStaffFacingName(profile)
        ),
        email: null,
        studentPackageId,
        packageLabel: studentPackageId
          ? packageLabelById.get(studentPackageId) ?? "Package"
          : "No student package row",
      } satisfies HomeworkTestStudent;
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function loadHomeworkTestStudent(
  supabase: SupabaseClient,
  cohortId: string,
  studentKey: string
): Promise<HomeworkTestStudent | null> {
  const students = await loadHomeworkTestStudents(supabase, cohortId);
  return students.find((row) => row.key === studentKey) ?? null;
}

export async function loadHomeworkTestPreview(
  supabase: SupabaseClient,
  input: {
    lessonId: string;
    cohortId: string;
    studentKey: string;
  }
): Promise<HomeworkTestPreview> {
  const [lesson, cohort, student] = await Promise.all([
    loadHomeworkTestLesson(supabase, input.lessonId),
    loadHomeworkTestCohort(supabase, input.cohortId),
    loadHomeworkTestStudent(supabase, input.cohortId, input.studentKey),
  ]);

  if (!lesson) throw new Error("Lesson not found.");
  if (!cohort) throw new Error("Cohort not found.");
  if (!student) throw new Error("Student is not in this cohort.");
  if (cohort.courseId !== lesson.courseId) {
    throw new Error("That cohort does not belong to the selected course.");
  }

  const actor = courseActorFromHomeworkTestStudent(student);
  const [segment, questions, submission] = await Promise.all([
    loadHomeworkSegmentForLesson(supabase, lesson.id),
    lesson.submissionType === "text"
      ? loadHomeworkQuestionsForLesson(supabase, lesson.id)
      : Promise.resolve([]),
    fetchFormalHomeworkForActor(supabase, actor, lesson.id),
  ]);

  const submissionType = segment?.submissionType ?? lesson.submissionType;
  const taskDescription = homeworkTaskDescription(
    { ...lesson, submissionType },
    segment?.activityInstructions
  );

  return {
    lesson: { ...lesson, submissionType },
    student,
    cohort,
    questions,
    submission,
    taskDescription,
  };
}

export async function loadHomeworkTestLessonView(
  supabase: SupabaseClient,
  lessonId: string
): Promise<HomeworkTestLessonView> {
  const lesson = await loadHomeworkTestLesson(supabase, lessonId);
  if (!lesson) throw new Error("Lesson not found.");

  const [{ data: course }, segment, questions] = await Promise.all([
    supabase.from("courses").select("name").eq("id", lesson.courseId).maybeSingle(),
    loadHomeworkSegmentForLesson(supabase, lesson.id),
    loadHomeworkQuestionsForLesson(supabase, lesson.id),
  ]);

  const submissionType = segment?.submissionType ?? lesson.submissionType;
  return {
    lesson: { ...lesson, submissionType },
    courseName: (course?.name as string | null) ?? "Course",
    questions: submissionType === "text" ? questions : [],
    taskDescription: homeworkTaskDescription(
      { ...lesson, submissionType },
      segment?.activityInstructions
    ),
  };
}

async function loadHomeworkTestLesson(
  supabase: SupabaseClient,
  lessonId: string
): Promise<HomeworkTestLesson | null> {
  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("id, course_id, lesson_number, title")
    .eq("id", lessonId)
    .maybeSingle();

  if (error) throw error;
  if (!lesson) return null;

  const lessons = await loadHomeworkTestLessons(supabase, lesson.course_id as string);
  return lessons.find((row) => row.id === lessonId) ?? null;
}

async function loadHomeworkTestCohort(
  supabase: SupabaseClient,
  cohortId: string
): Promise<HomeworkTestCohort | null> {
  const { data, error } = await supabase
    .from("cohorts")
    .select("id, name, course_id, tutor_id")
    .eq("id", cohortId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const cohorts = await loadHomeworkTestCohorts(supabase, data.course_id as string);
  return cohorts.find((row) => row.id === cohortId) ?? null;
}
