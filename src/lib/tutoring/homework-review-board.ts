import { getStaffFacingName } from "@/lib/profile/display-name";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { loadCohortMembershipRoster } from "@/lib/tutoring/cohort-attendance";
import {
  assignPendingToPackages,
  buildOneToOneHomeworkPackages,
  encodeHomeworkPackageId,
  homeworkLessonWeekLabel,
  homeworkReviewedKey,
  occupiedActorCourseKeysFromCohorts,
  type HomeworkBoardPendingRow,
  type HomeworkPackageEnrollment,
  type HomeworkPackageLesson,
  type HomeworkReviewPackage,
} from "@/lib/tutoring/homework-review-packages";
import {
  homeworkRosterActorKey,
  loadPendingHomeworkReviews,
} from "@/lib/tutoring/homework-submissions";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { HomeworkBoardPendingRow } from "@/lib/tutoring/homework-review-packages";

export type HomeworkReviewBoard = {
  packages: HomeworkReviewPackage[];
  pendingSubmissions: HomeworkBoardPendingRow[];
  reviewedKeys: string[];
};

type CourseRel = { id?: string | null; name?: string | null } | { id?: string | null; name?: string | null }[] | null;

type StudentPackageLink = {
  id: string;
  user_id: string;
  kid_profile_id: string | null;
  package_instance_id: string | null;
  course_id: string | null;
  status: string | null;
};

function courseFromRel(rel: CourseRel): { id: string; name: string } | null {
  const row = Array.isArray(rel) ? rel[0] : rel;
  if (!row?.id) return null;
  return { id: row.id, name: row.name?.trim() || "Course" };
}

async function loadCoverCohortIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.rpc("tutor_cover_cohort_ids");
  if (error && !error.message.includes("tutor_cover_cohort_ids")) {
    console.error("[homework-review-board] tutor_cover_cohort_ids failed", error.message);
  }
  return [
    ...new Set(
      (Array.isArray(data) ? data : [])
        .map((id) => (typeof id === "string" ? id : null))
        .filter((id): id is string => Boolean(id))
    ),
  ];
}

async function loadLessonsByCourseId(
  supabase: SupabaseClient,
  courseIds: string[]
): Promise<Map<string, HomeworkPackageLesson[]>> {
  const lessonsByCourse = new Map<string, HomeworkPackageLesson[]>();
  if (courseIds.length === 0) return lessonsByCourse;

  const { data, error } = await supabase
    .from("lessons")
    .select("id, course_id, lesson_number, title")
    .in("course_id", courseIds)
    .order("lesson_number");

  if (error) throw error;

  for (const row of data ?? []) {
    const courseId = row.course_id as string;
    const lessonNumber = (row.lesson_number as number | null) ?? 0;
    const title = (row.title as string | null) ?? "Lesson";
    const list = lessonsByCourse.get(courseId) ?? [];
    list.push({
      id: row.id as string,
      lessonNumber,
      title,
      weekLabel: homeworkLessonWeekLabel(lessonNumber, title),
    });
    lessonsByCourse.set(courseId, list);
  }

  return lessonsByCourse;
}

async function loadReviewedKeysForActors(
  supabase: SupabaseClient,
  actorIds: string[]
): Promise<string[]> {
  if (actorIds.length === 0) return [];

  const { data, error } = await supabase
    .from("homework_submissions")
    .select("student_id, kid_profile_id, lesson_id")
    .eq("status", "reviewed")
    .eq("is_practice", false)
    .or(`student_id.in.(${actorIds.join(",")}),kid_profile_id.in.(${actorIds.join(",")})`);

  if (error) {
    if (error.message.toLowerCase().includes("homework_submissions")) return [];
    throw error;
  }

  const keys = new Set<string>();
  for (const row of data ?? []) {
    const actorId = homeworkRosterActorKey(row);
    const lessonId = row.lesson_id as string | null;
    if (!actorId || !lessonId) continue;
    keys.add(homeworkReviewedKey(actorId, lessonId));
  }
  return [...keys];
}

export async function loadHomeworkReviewBoard(
  supabase: SupabaseClient,
  tutorId: string
): Promise<HomeworkReviewBoard> {
  let { data: enrollmentRows, error: enrollmentError } = await supabase
    .from("course_enrollments")
    .select(
      "id, user_id, course_id, delivery_mode, cohort_id, kid_profile_id, student_package_id, courses(id, name)"
    )
    .eq("tutor_id", tutorId)
    .order("created_at", { ascending: true });

  if (enrollmentError?.message.toLowerCase().includes("student_package_id")) {
    const retry = await supabase
      .from("course_enrollments")
      .select("id, user_id, course_id, delivery_mode, cohort_id, kid_profile_id, courses(id, name)")
      .eq("tutor_id", tutorId)
      .order("created_at", { ascending: true });
    enrollmentRows = (retry.data ?? []).map((row) => ({
      ...row,
      student_package_id: null,
    })) as typeof enrollmentRows;
    enrollmentError = retry.error;
  }

  if (enrollmentError) throw enrollmentError;

  const [
    { data: assignedCohortRows },
    coverCohortIds,
  ] = await Promise.all([
    supabase.from("cohorts").select("id, name, course_id, courses(id, name)").eq("tutor_id", tutorId),
    loadCoverCohortIds(supabase),
  ]);

  const enrollmentCohortIds = [
    ...new Set(
      (enrollmentRows ?? [])
        .filter((row) => row.delivery_mode === "group" && row.cohort_id)
        .map((row) => row.cohort_id as string)
    ),
  ];
  const allCohortIds = [
    ...new Set([
      ...enrollmentCohortIds,
      ...(assignedCohortRows ?? []).map((row) => row.id as string),
      ...coverCohortIds,
    ]),
  ];

  const missingCohortIds = allCohortIds.filter(
    (id) => !(assignedCohortRows ?? []).some((row) => row.id === id)
  );
  const { data: extraCohorts } =
    missingCohortIds.length > 0
      ? await supabase
          .from("cohorts")
          .select("id, name, course_id, courses(id, name)")
          .in("id", missingCohortIds)
      : { data: [] as Array<{
          id: string;
          name: string;
          course_id: string;
          courses: CourseRel;
        }> };

  const cohortMeta = new Map<
    string,
    { name: string; courseId: string; courseName: string }
  >();
  for (const row of [...(assignedCohortRows ?? []), ...(extraCohorts ?? [])]) {
    const course = courseFromRel(row.courses as CourseRel);
    cohortMeta.set(row.id as string, {
      name: (row.name as string | null)?.trim() || "Cohort",
      courseId: (row.course_id as string | null) || course?.id || "",
      courseName: course?.name ?? "Course",
    });
  }

  const studentPackageIds = [
    ...new Set(
      (enrollmentRows ?? [])
        .map((row) => row.student_package_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const userIds = [...new Set((enrollmentRows ?? []).map((row) => row.user_id as string))];
  const kidProfileIds = [
    ...new Set(
      (enrollmentRows ?? [])
        .map((row) => row.kid_profile_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const [{ data: profiles }, { data: linkedPackages }, { data: kidRows }] = await Promise.all([
    userIds.length > 0
      ? supabase.from("profiles").select("id, full_name, preferred_name").in("id", userIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            full_name: string | null;
            preferred_name: string | null;
          }>,
        }),
    studentPackageIds.length > 0
      ? supabase
          .from("student_packages")
          .select("id, user_id, kid_profile_id, package_instance_id, course_id, status")
          .in("id", studentPackageIds)
          .neq("status", "withdrawn")
      : Promise.resolve({ data: [] as StudentPackageLink[] }),
    kidProfileIds.length > 0
      ? supabase.from("kid_profiles").select("id, name").in("id", kidProfileIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }> }),
  ]);

  const packageById = new Map(
    (linkedPackages ?? []).map((row) => [row.id as string, row] as const)
  );
  const instanceIds = [
    ...new Set(
      (linkedPackages ?? [])
        .map((row) => row.package_instance_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const unlinkedUserIds = userIds.filter((userId) => {
    const enrollment = (enrollmentRows ?? []).find(
      (row) =>
        row.user_id === userId &&
        row.delivery_mode !== "group" &&
        !row.student_package_id
    );
    return Boolean(enrollment);
  });

  const { data: fallbackPackages } =
    unlinkedUserIds.length > 0
      ? await supabase
          .from("student_packages")
          .select("id, user_id, kid_profile_id, package_instance_id, course_id, status")
          .in("user_id", unlinkedUserIds)
          .neq("status", "withdrawn")
      : { data: [] as StudentPackageLink[] };

  for (const row of fallbackPackages ?? []) {
    if (row.package_instance_id) {
      instanceIds.push(row.package_instance_id as string);
    }
  }

  const uniqueInstanceIds = [...new Set(instanceIds)];
  const { data: instanceRows } =
    uniqueInstanceIds.length > 0
      ? await supabase
          .from("package_instances")
          .select("id, name, course_id")
          .in("id", uniqueInstanceIds)
      : { data: [] as Array<{ id: string; name: string | null; course_id: string | null }> };

  const instanceById = new Map(
    (instanceRows ?? []).map((row) => [row.id as string, row] as const)
  );

  const fallbackByUserCourse = new Map<string, StudentPackageLink>();
  for (const row of fallbackPackages ?? []) {
    const key = `${row.user_id}:${row.course_id ?? ""}:${row.kid_profile_id ?? ""}`;
    if (!fallbackByUserCourse.has(key) && row.package_instance_id) {
      fallbackByUserCourse.set(key, row);
    }
  }

  const nameByUserId = new Map<string, string>();
  for (const profile of profiles ?? []) {
    const name = getStaffFacingName(profile);
    if (name) nameByUserId.set(profile.id, name);
  }
  if (userIds.some((id) => !nameByUserId.has(id))) {
    const { client } = tryCreateServiceRoleClient();
    if (client) {
      const missing = userIds.filter((id) => !nameByUserId.has(id));
      const { data: adminProfiles } = await client
        .from("profiles")
        .select("id, full_name, preferred_name")
        .in("id", missing);
      for (const profile of adminProfiles ?? []) {
        const name = getStaffFacingName(profile);
        if (name) nameByUserId.set(profile.id, name);
      }
    }
  }

  const kidNameById = new Map<string, string>();
  for (const kid of kidRows ?? []) {
    const name = kid.name?.trim();
    if (name) kidNameById.set(kid.id, name);
  }
  if (kidProfileIds.some((id) => !kidNameById.has(id))) {
    const { loadKidProfileNames } = await import("@/lib/tutoring/cohort-attendance");
    const extra = await loadKidProfileNames(supabase, kidProfileIds);
    for (const [id, name] of extra) kidNameById.set(id, name);
  }

  const enrollments: HomeworkPackageEnrollment[] = (enrollmentRows ?? []).map((row) => {
    const course = courseFromRel(row.courses as CourseRel);
    const kidId = (row.kid_profile_id as string | null) ?? null;
    const linked = row.student_package_id
      ? packageById.get(row.student_package_id as string)
      : fallbackByUserCourse.get(`${row.user_id}:${row.course_id}:${kidId ?? ""}`) ??
        (kidId
          ? undefined
          : fallbackByUserCourse.get(`${row.user_id}:${row.course_id}:`));
    const instanceId = (linked?.package_instance_id as string | null) ?? null;
    const instance = instanceId ? instanceById.get(instanceId) : null;
    const kidName = row.kid_profile_id
      ? kidNameById.get(row.kid_profile_id as string)
      : null;
    return {
      enrollmentId: row.id as string,
      userId: row.user_id as string,
      kidProfileId: (row.kid_profile_id as string | null) ?? null,
      courseId: (row.course_id as string | null) || course?.id || "",
      courseName: course?.name ?? "Course",
      deliveryMode: (row.delivery_mode as string | null) ?? null,
      cohortId: (row.cohort_id as string | null) ?? null,
      packageInstanceId: instanceId,
      packageInstanceName: instance?.name ?? null,
      actorName:
        kidName?.trim() ||
        nameByUserId.get(row.user_id as string) ||
        instance?.name?.trim() ||
        "Student",
    };
  });

  const cohortPackages: HomeworkReviewPackage[] = (
    await Promise.all(
      allCohortIds.map(async (cohortId) => {
        const meta = cohortMeta.get(cohortId);
        if (!meta?.courseId) return null;
        const students = await loadCohortMembershipRoster(supabase, cohortId);
        if (students.length === 0) return null;
        return {
          id: encodeHomeworkPackageId({ kind: "cohort", id: cohortId }),
          kind: "cohort" as const,
          name: meta.name,
          courseId: meta.courseId,
          courseName: meta.courseName,
          students: students.map((student) => ({
            studentId: student.studentId,
            studentName: student.studentName,
          })),
          lessons: [] as HomeworkPackageLesson[],
        };
      })
    )
  ).filter((pack): pack is HomeworkReviewPackage => Boolean(pack));

  const occupied = occupiedActorCourseKeysFromCohorts(cohortPackages);
  const oneToOnePackages = buildOneToOneHomeworkPackages(enrollments, occupied);

  const courseIds = [
    ...new Set([
      ...cohortPackages.map((pack) => pack.courseId),
      ...oneToOnePackages.map((pack) => pack.courseId),
    ]),
  ].filter(Boolean);

  const lessonsByCourse = await loadLessonsByCourseId(supabase, courseIds);

  const withLessons: HomeworkReviewPackage[] = [
    ...cohortPackages,
    ...oneToOnePackages.map((pack) => ({
      ...pack,
      lessons: lessonsByCourse.get(pack.courseId) ?? [],
    })),
  ].map((pack) => ({
    ...pack,
    lessons: pack.lessons.length > 0 ? pack.lessons : lessonsByCourse.get(pack.courseId) ?? [],
  }));

  const pending = await loadPendingHomeworkReviews(supabase);
  const assignments = assignPendingToPackages(withLessons, pending);
  const packageIdBySubmission = new Map(
    assignments.map((row) => [row.submissionId, row.packageId] as const)
  );

  const pendingSubmissions: HomeworkBoardPendingRow[] = pending
    .map((row) => {
      const packageId = packageIdBySubmission.get(row.id);
      if (!packageId) return null;
      return { ...row, packageId };
    })
    .filter((row): row is HomeworkBoardPendingRow => Boolean(row))
    .sort(
      (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
    );

  const actorIds = [
    ...new Set(withLessons.flatMap((pack) => pack.students.map((student) => student.studentId))),
  ];
  const reviewedKeys = await loadReviewedKeysForActors(supabase, actorIds);

  const packages = withLessons
    .filter((pack) => pack.students.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return { packages, pendingSubmissions, reviewedKeys };
}
