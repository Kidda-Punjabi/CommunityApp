import "server-only";

import {
  ACTIONED_STATUSES,
  BELOW_PAR_OVERALL_SCORE,
  DELIVERY_CLASS_TYPES,
  DELIVERY_TUTORS,
  KIDDA_CLASS_TITLE_NEEDLE,
  TUTOR_PROFILE_MATCHERS,
  VIDEO_TESTIMONIAL_RECORDED_STATUSES,
  type DeliveryClassTypeId,
  type DeliveryTutorName,
} from "@/lib/admin/delivery/constants";
import { classTypeFromEnrollment, classTypeFromFeedback, classTypeLabel } from "@/lib/admin/delivery/class-type";
import { inRange, resolveDeliveryRange } from "@/lib/admin/delivery/date-range";
import {
  average,
  averageOpsMetricFromGroups,
  buildRatingChart,
  consecutiveTrailingFalse,
  daysBetween,
  opsMetricFromGroups,
  ratingMetric,
  round0,
  round1,
} from "@/lib/admin/delivery/metrics";
import type {
  DeliveryAtRiskStudent,
  DeliveryFiltersInput,
  DeliveryOffboardingRow,
  DeliveryOpsMetric,
  DeliveryReviewRow,
  DeliverySnapshot,
  DeliveryTestimonialRow,
  DeliveryTutorRow,
} from "@/lib/admin/delivery/types";
import { loadEmailsByUserId } from "@/lib/admin/load-admin-profiles-with-email";
import { packageStatusLabel, type PackageInstanceStatus } from "@/lib/admin/package-status";
import {
  isFeedbackToReview,
  isTestimonialPending,
} from "@/lib/notion/feedback-response-map";
import { getStaffFacingName } from "@/lib/profile/display-name";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import type { SupabaseClient } from "@supabase/supabase-js";

type FeedbackRow = {
  id: string;
  notion_page_id: string;
  full_name: string | null;
  email: string | null;
  tutor: string | null;
  cohort: string | null;
  course: string | null;
  lesson: string | null;
  feedback_date: string | null;
  learning_relevance: number | null;
  confidence: number | null;
  tutor_effectiveness: number | null;
  overall_score: number | null;
  video_testimonial: string | null;
  video_testimonial_recorded: string | null;
  actioned: string | null;
  critical_feedback: boolean | null;
  comments: string | null;
};

type SessionRow = {
  id: string;
  tutor_id: string;
  student_id: string | null;
  cohort_id: string | null;
  course_id: string | null;
  title: string;
  starts_at: string;
  status: string;
  week_number: number | null;
};

function isDeliveryTutor(name: string | null | undefined): name is DeliveryTutorName {
  return Boolean(name && (DELIVERY_TUTORS as readonly string[]).includes(name));
}

export function notionTutorFromProfileName(
  name: string | null | undefined
): DeliveryTutorName | null {
  const value = name ?? "";
  for (const matcher of TUTOR_PROFILE_MATCHERS) {
    if (matcher.pattern.test(value)) return matcher.notionName;
  }
  return null;
}

function matchesFilters(
  row: {
    tutor: string | null;
    course: string | null;
    cohort: string | null;
    feedback_date: string | null;
  },
  filters: DeliveryFiltersInput,
  start: Date,
  end: Date
): boolean {
  if (filters.tutor !== "all" && row.tutor !== filters.tutor) return false;
  if (
    filters.classType !== "all" &&
    classTypeFromFeedback(row.course, row.cohort) !== filters.classType
  ) {
    return false;
  }
  return inRange(row.feedback_date, start, end);
}

function emptyTutorRow(tutor: DeliveryTutorName): DeliveryTutorRow {
  return {
    tutor,
    learningRelevance: null,
    confidence: null,
    tutorEffectiveness: null,
    attendancePercent: null,
    feedbackSample: 0,
    attendanceSample: 0,
  };
}

function isKiddaClassTitle(title: string): boolean {
  return title.toLowerCase().includes(KIDDA_CLASS_TITLE_NEEDLE.toLowerCase());
}

export async function loadDeliverySnapshot(
  supabase: SupabaseClient,
  filters: DeliveryFiltersInput,
  now = new Date()
): Promise<DeliverySnapshot> {
  const range = resolveDeliveryRange(filters.rangeId, now, {
    from: filters.customFrom ?? "",
    to: filters.customTo ?? "",
  });

  const [
    feedbackResult,
    sessionsResult,
    attendanceResult,
    homeworkResult,
    enrollmentsResult,
    accessResult,
    quizResult,
    publicQuizResult,
    homeworkSubmissionsResult,
    packagesResult,
    instancesResult,
    cohortsResult,
    membersResult,
    lessonsResult,
    profilesResult,
  ] = await Promise.all([
    fetchAllRows<FeedbackRow>(
      supabase,
      "feedback_responses",
      "id, notion_page_id, full_name, email, tutor, cohort, course, lesson, feedback_date, learning_relevance, confidence, tutor_effectiveness, overall_score, video_testimonial, video_testimonial_recorded, actioned, critical_feedback, comments",
      [{ column: "feedback_date", ascending: false }]
    ),
    supabase
      .from("tutor_scheduled_sessions")
      .select("id, tutor_id, student_id, cohort_id, course_id, title, starts_at, status, week_number")
      .ilike("title", `%${KIDDA_CLASS_TITLE_NEEDLE}%`)
      .neq("status", "cancelled")
      .gte("starts_at", range.previousStart.toISOString()),
    fetchAllRows<{
      cohort_id: string;
      lesson_id: string;
      student_id: string | null;
      attended: boolean;
      marked_at: string;
    }>(supabase, "cohort_lesson_attendance", "cohort_id, lesson_id, student_id, attended, marked_at"),
    fetchAllRows<{
      cohort_id: string;
      lesson_id: string;
      student_id: string | null;
      completed: boolean;
    }>(supabase, "cohort_lesson_homework", "cohort_id, lesson_id, student_id, completed"),
    supabase
      .from("course_enrollments")
      .select("id, user_id, course_id, tutor_id, delivery_mode, cohort_id, courses(name)"),
    supabase.from("course_access").select("user_id, course_id, courses(name)"),
    supabase
      .from("quiz_progress")
      .select("user_id, score, completed, last_attempted_at")
      .eq("completed", true)
      .not("score", "is", null),
    supabase.from("public_quiz_attempts").select("email, score, submitted_at"),
    supabase.from("homework_submissions").select("student_id, submitted_at, is_practice"),
    supabase
      .from("student_packages")
      .select("id, user_id, status, course_id, enrollment_id, package_instance_id")
      .eq("status", "confirmed"),
    supabase.from("package_instances").select("id, name, status, tutor_id"),
    supabase.from("cohorts").select("id, name, status, tutor_id, course_id"),
    supabase.from("cohort_members").select("cohort_id, user_id, left_at").is("left_at", null),
    supabase.from("lessons").select("id, course_id, lesson_number"),
    supabase.from("profiles").select("id, full_name, preferred_name, app_role"),
  ]);

  const errors = [
    feedbackResult.error?.message,
    sessionsResult.error?.message,
    attendanceResult.error?.message,
    homeworkResult.error?.message,
    enrollmentsResult.error?.message,
    accessResult.error?.message,
    quizResult.error?.message,
    publicQuizResult.error?.message,
    homeworkSubmissionsResult.error?.message,
    packagesResult.error?.message,
    instancesResult.error?.message,
    cohortsResult.error?.message,
    membersResult.error?.message,
    lessonsResult.error?.message,
    profilesResult.error?.message,
  ].filter(Boolean);

  const feedback = feedbackResult.data;
  const currentFeedback = feedback.filter((row) =>
    matchesFilters(row, filters, range.start, range.end)
  );
  const previousFeedback = feedback.filter((row) =>
    matchesFilters(row, filters, range.previousStart, range.previousEnd)
  );

  const ratings = {
    learningRelevance: ratingMetric(
      currentFeedback.map((row) => row.learning_relevance),
      previousFeedback.map((row) => row.learning_relevance)
    ),
    confidence: ratingMetric(
      currentFeedback.map((row) => row.confidence),
      previousFeedback.map((row) => row.confidence)
    ),
    tutorEffectiveness: ratingMetric(
      currentFeedback.map((row) => row.tutor_effectiveness),
      previousFeedback.map((row) => row.tutor_effectiveness)
    ),
  };

  const chart = buildRatingChart(
    currentFeedback.map((row) => ({
      feedbackDate: row.feedback_date,
      learningRelevance: row.learning_relevance,
      confidence: row.confidence,
      tutorEffectiveness: row.tutor_effectiveness,
    })),
    range.start,
    range.end
  );

  const profileById = new Map(
    (profilesResult.data ?? []).map((row) => [
      row.id as string,
      {
        name: getStaffFacingName(row) ?? (row.full_name as string | null) ?? "Unknown",
        appRole: row.app_role as string | null,
        notionTutor: notionTutorFromProfileName(row.full_name as string | null),
      },
    ])
  );

  const emailByUserId = new Map<string, string>();
  for (const [userId, email] of await loadEmailsByUserId(supabase, null)) {
    const normalized = email?.trim().toLowerCase();
    if (normalized) emailByUserId.set(userId, normalized);
  }

  const courseName = (rel: unknown): string | null => {
    const value = Array.isArray(rel) ? rel[0] : rel;
    if (value && typeof value === "object" && "name" in value) {
      return (value as { name?: string }).name ?? null;
    }
    return null;
  };

  const enrollments = (enrollmentsResult.data ?? []).map((row) => ({
    userId: row.user_id as string | null,
    courseId: row.course_id as string,
    tutorId: row.tutor_id as string | null,
    cohortId: row.cohort_id as string | null,
    classType: classTypeFromEnrollment(courseName(row.courses), row.delivery_mode as string | null),
    tutor: notionTutorFromProfileName(profileById.get(row.tutor_id as string)?.name ?? null),
  }));

  const enrollmentByUserCourse = new Map<string, (typeof enrollments)[number]>();
  for (const enrollment of enrollments) {
    if (enrollment.userId) {
      enrollmentByUserCourse.set(`${enrollment.userId}:${enrollment.courseId}`, enrollment);
    }
  }

  const sessions = ((sessionsResult.data ?? []) as SessionRow[]).filter((session) =>
    isKiddaClassTitle(session.title)
  );
  const pastSessionsInRange = sessions.filter(
    (session) =>
      session.status === "scheduled" &&
      inRange(session.starts_at, range.start, range.end) &&
      new Date(session.starts_at).getTime() <= now.getTime()
  );

  const lessons = (lessonsResult.data ?? []) as Array<{
    id: string;
    course_id: string;
    lesson_number: number | null;
  }>;
  const lessonByCourseWeek = new Map<string, string>();
  for (const lesson of lessons) {
    if (lesson.lesson_number == null) continue;
    lessonByCourseWeek.set(`${lesson.course_id}:${lesson.lesson_number}`, lesson.id);
  }

  const attendance = attendanceResult.data;
  const attendanceByCohortLessonStudent = new Map<string, boolean>();
  for (const row of attendance) {
    if (!row.student_id) continue;
    attendanceByCohortLessonStudent.set(
      `${row.cohort_id}:${row.lesson_id}:${row.student_id}`,
      row.attended
    );
  }

  const homework = homeworkResult.data;
  const homeworkByCohortLessonStudent = new Map<string, boolean>();
  for (const row of homework) {
    if (!row.student_id) continue;
    homeworkByCohortLessonStudent.set(
      `${row.cohort_id}:${row.lesson_id}:${row.student_id}`,
      row.completed
    );
  }

  function sessionClassType(session: SessionRow): DeliveryClassTypeId | null {
    if (session.title.toLowerCase().includes("community")) return "community";
    const enrollment = enrollments.find(
      (row) =>
        (session.student_id && row.userId === session.student_id && row.courseId === session.course_id) ||
        (session.cohort_id && row.cohortId === session.cohort_id)
    );
    return enrollment?.classType ?? (session.cohort_id ? "beginner_group" : null);
  }

  function sessionTutorName(session: SessionRow): DeliveryTutorName | null {
    return profileById.get(session.tutor_id)?.notionTutor ?? null;
  }

  function sessionMatchesFilters(session: SessionRow): boolean {
    const tutorName = sessionTutorName(session);
    if (filters.tutor !== "all" && tutorName !== filters.tutor) return false;
    const classType = sessionClassType(session);
    if (filters.classType !== "all" && classType !== filters.classType) return false;
    return true;
  }

  const filteredPastSessions = pastSessionsInRange.filter(sessionMatchesFilters);

  const attendanceGroups = new Map<DeliveryClassTypeId, { hits: number; total: number }>();
  const homeworkGroups = new Map<DeliveryClassTypeId, { hits: number; total: number }>();
  const attendanceByTutor = new Map<DeliveryTutorName, { hits: number; total: number }>();

  const membersByCohort = new Map<string, string[]>();
  for (const row of membersResult.data ?? []) {
    const cohortId = row.cohort_id as string;
    const userId = row.user_id as string | null;
    if (!userId) continue;
    const list = membersByCohort.get(cohortId) ?? [];
    list.push(userId);
    membersByCohort.set(cohortId, list);
  }

  for (const session of filteredPastSessions) {
    const classType = sessionClassType(session);
    if (!classType || !session.cohort_id || session.week_number == null || !session.course_id) {
      continue;
    }
    const lessonId = lessonByCourseWeek.get(`${session.course_id}:${session.week_number}`);
    if (!lessonId) continue;
    const studentIds = membersByCohort.get(session.cohort_id) ?? [];
    const tutorName = sessionTutorName(session);
    for (const studentId of studentIds) {
      const key = `${session.cohort_id}:${lessonId}:${studentId}`;
      const attended = attendanceByCohortLessonStudent.get(key);
      if (attended != null) {
        const group = attendanceGroups.get(classType) ?? { hits: 0, total: 0 };
        group.total += 1;
        if (attended) group.hits += 1;
        attendanceGroups.set(classType, group);
        if (tutorName) {
          const tutorGroup = attendanceByTutor.get(tutorName) ?? { hits: 0, total: 0 };
          tutorGroup.total += 1;
          if (attended) tutorGroup.hits += 1;
          attendanceByTutor.set(tutorName, tutorGroup);
        }
      }
      const completed = homeworkByCohortLessonStudent.get(key);
      if (completed != null) {
        const group = homeworkGroups.get(classType) ?? { hits: 0, total: 0 };
        group.total += 1;
        if (completed) group.hits += 1;
        homeworkGroups.set(classType, group);
      }
    }
  }

  const homeworkFromSubmissions = new Map<DeliveryClassTypeId, { hits: number; total: number }>();
  for (const row of homeworkSubmissionsResult.data ?? []) {
    if (row.is_practice) continue;
    if (!inRange(row.submitted_at as string, range.start, range.end)) continue;
    const studentId = row.student_id as string | null;
    if (!studentId) continue;
    const enrollment = enrollments.find((item) => item.userId === studentId);
    if (!enrollment?.classType) continue;
    if (filters.tutor !== "all" && enrollment.tutor !== filters.tutor) continue;
    if (filters.classType !== "all" && enrollment.classType !== filters.classType) continue;
    const group = homeworkFromSubmissions.get(enrollment.classType) ?? { hits: 0, total: 0 };
    group.total += 1;
    group.hits += 1;
    homeworkFromSubmissions.set(enrollment.classType, group);
  }

  const mergedHomework = DELIVERY_CLASS_TYPES.map((type) => {
    const marked = homeworkGroups.get(type.id);
    if (marked && marked.total > 0) return { classType: type.id, hits: marked.hits, total: marked.total };
    const submitted = homeworkFromSubmissions.get(type.id);
    if (submitted) return { classType: type.id, hits: submitted.hits, total: submitted.total };
    return { classType: type.id, hits: 0, total: 0 };
  });

  const homeworkMetric: DeliveryOpsMetric = opsMetricFromGroups(mergedHomework);
  const attendanceMetric: DeliveryOpsMetric = opsMetricFromGroups(
    [...attendanceGroups.entries()].map(([classType, group]) => ({ classType, ...group }))
  );

  const quizValues = new Map<DeliveryClassTypeId, number[]>();
  const emailToUserId = new Map<string, string>();
  for (const [userId, email] of emailByUserId) {
    emailToUserId.set(email, userId);
  }

  for (const row of quizResult.data ?? []) {
    if (!inRange(row.last_attempted_at as string | null, range.start, range.end)) continue;
    const score = row.score as number | null;
    if (score == null) continue;
    const userId = row.user_id as string | null;
    if (!userId) continue;
    const enrollment = enrollments.find((item) => item.userId === userId);
    if (!enrollment?.classType) continue;
    if (filters.tutor !== "all" && enrollment.tutor !== filters.tutor) continue;
    if (filters.classType !== "all" && enrollment.classType !== filters.classType) continue;
    const list = quizValues.get(enrollment.classType) ?? [];
    list.push(score);
    quizValues.set(enrollment.classType, list);
  }
  for (const row of publicQuizResult.data ?? []) {
    if (!inRange(row.submitted_at as string, range.start, range.end)) continue;
    const email = String(row.email ?? "").trim().toLowerCase();
    const userId = emailToUserId.get(email);
    if (!userId) continue;
    const enrollment = enrollments.find((item) => item.userId === userId);
    if (!enrollment?.classType) continue;
    if (filters.tutor !== "all" && enrollment.tutor !== filters.tutor) continue;
    if (filters.classType !== "all" && enrollment.classType !== filters.classType) continue;
    const list = quizValues.get(enrollment.classType) ?? [];
    list.push(row.score as number);
    quizValues.set(enrollment.classType, list);
  }
  const quizMetric = averageOpsMetricFromGroups(
    [...quizValues.entries()].map(([classType, values]) => ({ classType, values }))
  );

  const staffIds = new Set(
    [...profileById.entries()]
      .filter(([, profile]) => profile.appRole && profile.appRole !== "member")
      .map(([id]) => id)
  );

  const futureSessions = (sessionsResult.data ?? []).filter(
    (row) =>
      row.status === "scheduled" &&
      new Date(row.starts_at as string).getTime() > now.getTime()
  ) as SessionRow[];

  const futureSessionUserIds = new Set<string>();
  for (const session of futureSessions) {
    if (session.student_id) futureSessionUserIds.add(session.student_id);
    if (session.cohort_id) {
      for (const userId of membersByCohort.get(session.cohort_id) ?? []) {
        futureSessionUserIds.add(userId);
      }
    }
  }

  const accessRows = (accessResult.data ?? []).filter((row) => {
    const name = courseName(row.courses);
    return Boolean(name) && !/kid|english|driving|living in|life in|work and/i.test(name ?? "");
  });

  const noScheduled: DeliveryAtRiskStudent[] = [];
  const seenNoSchedule = new Set<string>();
  for (const row of accessRows) {
    const userId = row.user_id as string | null;
    if (!userId || staffIds.has(userId) || futureSessionUserIds.has(userId)) continue;
    if (seenNoSchedule.has(userId)) continue;
    const enrollment = enrollments.find((item) => item.userId === userId);
    if (filters.tutor !== "all" && enrollment?.tutor !== filters.tutor) continue;
    const classType =
      enrollment?.classType ?? classTypeFromEnrollment(courseName(row.courses), null);
    if (filters.classType !== "all" && classType !== filters.classType) continue;
    seenNoSchedule.add(userId);
    const lastPast = sessions
      .filter(
        (session) =>
          new Date(session.starts_at).getTime() <= now.getTime() &&
          (session.student_id === userId ||
            (session.cohort_id && (membersByCohort.get(session.cohort_id) ?? []).includes(userId)))
      )
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
    noScheduled.push({
      userId,
      name: profileById.get(userId)?.name ?? "Unknown",
      tutor: enrollment?.tutor ?? null,
      classType,
      classTypeLabel: classTypeLabel(classType),
      cohortOrCourse: courseName(row.courses) ?? "Course access",
      daysSinceLastActivity: daysBetween(lastPast?.starts_at, now),
      detail: "Valid course access, no upcoming scheduled sessions",
    });
  }

  const pastKiddaByCohort = new Map<string, SessionRow[]>();
  for (const session of sessions) {
    if (!session.cohort_id) continue;
    if (new Date(session.starts_at).getTime() > now.getTime()) continue;
    if (session.status !== "scheduled") continue;
    const list = pastKiddaByCohort.get(session.cohort_id) ?? [];
    list.push(session);
    pastKiddaByCohort.set(session.cohort_id, list);
  }
  for (const list of pastKiddaByCohort.values()) {
    list.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }

  const stoppedAttending: DeliveryAtRiskStudent[] = [];
  const seenStopped = new Set<string>();
  for (const [cohortId, cohortSessions] of pastKiddaByCohort) {
    const recent = cohortSessions.slice(-8);
    for (const userId of membersByCohort.get(cohortId) ?? []) {
      if (staffIds.has(userId) || seenStopped.has(userId)) continue;
      const enrollment = enrollments.find(
        (item) => item.userId === userId && item.cohortId === cohortId
      );
      if (filters.tutor !== "all" && enrollment?.tutor !== filters.tutor) continue;
      const classType = enrollment?.classType ?? "beginner_group";
      if (filters.classType !== "all" && classType !== filters.classType) continue;
      const flags: Array<boolean | null> = recent.map((session) => {
        if (!session.course_id || session.week_number == null) return null;
        const lessonId = lessonByCourseWeek.get(`${session.course_id}:${session.week_number}`);
        if (!lessonId) return null;
        const attended = attendanceByCohortLessonStudent.get(`${cohortId}:${lessonId}:${userId}`);
        return attended ?? null;
      });
      if (consecutiveTrailingFalse(flags) < 2) continue;
      seenStopped.add(userId);
      const lastPast = recent[recent.length - 1];
      const cohortName =
        ((cohortsResult.data ?? []).find((cohort) => cohort.id === cohortId)?.name as string | null) ??
        "Cohort";
      stoppedAttending.push({
        userId,
        name: profileById.get(userId)?.name ?? "Unknown",
        tutor: enrollment?.tutor ?? sessionTutorName(recent[recent.length - 1]),
        classType,
        classTypeLabel: classTypeLabel(classType),
        cohortOrCourse: cohortName,
        daysSinceLastActivity: daysBetween(lastPast?.starts_at, now),
        detail: "Missed 2+ consecutive Kidda Class sessions",
      });
    }
  }

  const instanceById = new Map(
    (instancesResult.data ?? []).map((row) => [row.id as string, row] as const)
  );
  const cohortById = new Map(
    (cohortsResult.data ?? []).map((row) => [row.id as string, row] as const)
  );
  const pendingOffboarding: DeliveryOffboardingRow[] = [];
  for (const pkg of packagesResult.data ?? []) {
    const userId = pkg.user_id as string | null;
    if (!userId || staffIds.has(userId)) continue;
    let runStatus: PackageInstanceStatus | null = null;
    let runName = "Package";
    let tutorId: string | null = null;
    if (pkg.package_instance_id) {
      const instance = instanceById.get(pkg.package_instance_id as string);
      runStatus = (instance?.status as PackageInstanceStatus | undefined) ?? null;
      runName = (instance?.name as string | null) ?? runName;
      tutorId = (instance?.tutor_id as string | null) ?? null;
    } else if (pkg.enrollment_id) {
      const enrollment = enrollments.find((item) => item.userId === userId);
      if (enrollment?.cohortId) {
        const cohort = cohortById.get(enrollment.cohortId);
        runStatus = (cohort?.status as PackageInstanceStatus | undefined) ?? null;
        runName = (cohort?.name as string | null) ?? runName;
        tutorId = (cohort?.tutor_id as string | null) ?? enrollment.tutorId;
      }
    }
    if (runStatus !== "classes_completed") continue;
    const tutor = notionTutorFromProfileName(profileById.get(tutorId ?? "")?.name ?? null);
    const enrollment = enrollments.find((item) => item.userId === userId);
    if (filters.tutor !== "all" && tutor !== filters.tutor && enrollment?.tutor !== filters.tutor) {
      continue;
    }
    const classType = enrollment?.classType ?? null;
    if (filters.classType !== "all" && classType !== filters.classType) continue;
    pendingOffboarding.push({
      userId,
      name: profileById.get(userId)?.name ?? "Unknown",
      tutor: tutor ?? enrollment?.tutor ?? null,
      classType,
      classTypeLabel: classTypeLabel(classType),
      packageRunName: runName,
      statusLabel: packageStatusLabel("classes_completed"),
    });
  }

  const testimonials: DeliveryTestimonialRow[] = currentFeedback
    .filter((row) =>
      isTestimonialPending({
        lesson: row.lesson,
        videoTestimonial: row.video_testimonial,
        videoTestimonialRecorded: row.video_testimonial_recorded,
      })
    )
    .map((row) => ({
      id: row.id,
      notionPageId: row.notion_page_id,
      fullName: row.full_name || "Unknown",
      email: row.email,
      tutor: row.tutor,
      course: row.course,
      lesson: row.lesson,
      videoTestimonial: row.video_testimonial,
      videoTestimonialRecorded: row.video_testimonial_recorded,
      feedbackDate: row.feedback_date,
    }));

  const toReview: DeliveryReviewRow[] = currentFeedback
    .filter((row) =>
      isFeedbackToReview(
        { criticalFeedback: row.critical_feedback, overallScore: row.overall_score },
        BELOW_PAR_OVERALL_SCORE
      )
    )
    .map((row) => ({
      id: row.id,
      notionPageId: row.notion_page_id,
      fullName: row.full_name || "Unknown",
      email: row.email,
      tutor: row.tutor,
      course: row.course,
      lesson: row.lesson,
      overallScore: row.overall_score,
      learningRelevance: row.learning_relevance,
      confidence: row.confidence,
      tutorEffectiveness: row.tutor_effectiveness,
      criticalFeedback: Boolean(row.critical_feedback),
      belowPar: (row.overall_score ?? 99) < BELOW_PAR_OVERALL_SCORE,
      actioned: row.actioned,
      comments: row.comments,
      feedbackDate: row.feedback_date,
    }));

  const perTutor: DeliveryTutorRow[] = DELIVERY_TUTORS.map((tutor) => {
    const rows = currentFeedback.filter((row) => row.tutor === tutor);
    const att = attendanceByTutor.get(tutor);
    return {
      tutor,
      learningRelevance: round1(average(rows.map((row) => row.learning_relevance))),
      confidence: round1(average(rows.map((row) => row.confidence))),
      tutorEffectiveness: round1(average(rows.map((row) => row.tutor_effectiveness))),
      attendancePercent: att && att.total > 0 ? round0((att.hits / att.total) * 100) : null,
      feedbackSample: rows.length,
      attendanceSample: att?.total ?? 0,
    };
  });

  const teamAttendanceHits = [...attendanceByTutor.values()].reduce((sum, group) => sum + group.hits, 0);
  const teamAttendanceTotal = [...attendanceByTutor.values()].reduce(
    (sum, group) => sum + group.total,
    0
  );
  const teamAverage: DeliveryTutorRow = {
    tutor: "Team average",
    learningRelevance: round1(average(perTutor.map((row) => row.learningRelevance))),
    confidence: round1(average(perTutor.map((row) => row.confidence))),
    tutorEffectiveness: round1(average(perTutor.map((row) => row.tutorEffectiveness))),
    attendancePercent:
      teamAttendanceTotal > 0 ? round0((teamAttendanceHits / teamAttendanceTotal) * 100) : null,
    feedbackSample: currentFeedback.length,
    attendanceSample: teamAttendanceTotal,
  };

  return {
    generatedAt: now.toISOString(),
    rangeLabel: range.label,
    rangeStart: range.start.toISOString(),
    rangeEnd: range.end.toISOString(),
    belowParThreshold: BELOW_PAR_OVERALL_SCORE,
    feedbackRowCount: currentFeedback.length,
    ratings,
    chart,
    homework: homeworkMetric,
    quiz: quizMetric,
    attendance: attendanceMetric,
    stoppedAttending,
    noScheduledClasses: noScheduled.sort(
      (a, b) => (b.daysSinceLastActivity ?? 0) - (a.daysSinceLastActivity ?? 0)
    ),
    pendingOffboarding,
    pendingOffboardingNote:
      "Listed from package/cohort status Classes completed (not yet Offboarding complete). Confirm if this should instead come from the Notion Offboarding routine.",
    testimonials,
    toReview,
    perTutor,
    teamAverage,
    actionedStatuses: ACTIONED_STATUSES,
    videoTestimonialRecordedStatuses: VIDEO_TESTIMONIAL_RECORDED_STATUSES,
    error: errors.length > 0 ? errors.join(" · ") : undefined,
  };
}
