import {
  NOTION_COURSE_OPTIONS,
  NOTION_TUTOR_OPTIONS,
  isWeek12FeedbackForm,
  isWeek1BaselineForm,
  type FeedbackFormVariant,
  type NotionCourseOption,
} from "./constants";
import type { FeedbackContext } from "./types";
import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";

function courseOptionFromTier(tier: string | null | undefined): NotionCourseOption {
  switch ((tier ?? "").toLowerCase()) {
    case "beginners":
      return "Beginners Course";
    case "community":
      return "Community";
    default:
      return "Foundational Course";
  }
}

function lessonLabelFor(
  course: NotionCourseOption,
  lessonNumber: number | null | undefined
): string {
  if (!lessonNumber || lessonNumber < 1) {
    return course === "Community" ? "Community" : "N/A";
  }
  if (course === "Community" && lessonNumber > 12) {
    return "Community";
  }
  if (lessonNumber <= 12) {
    return `Lesson ${lessonNumber}`;
  }
  return "N/A";
}

function cohortLabel(cohortName: string | null | undefined): string {
  const name = cohortName?.trim();
  return name ? name : "N/A";
}

function matchSingleTutorName(rawName: string): string | null {
  const normalized = rawName.trim().toLowerCase();
  const exact = NOTION_TUTOR_OPTIONS.find(
    (option) => option.toLowerCase() === normalized
  );
  if (exact) return exact;

  const inputFirst = normalized.split(/\s+/)[0];
  return (
    NOTION_TUTOR_OPTIONS.find((option) => {
      const opt = option.toLowerCase();
      const optFirst = opt.split(/\s+/)[0];
      return (
        opt === normalized ||
        opt.includes(normalized) ||
        normalized.includes(opt) ||
        inputFirst === optFirst
      );
    }) ?? null
  );
}

/** Map profile names to a canonical Notion Tutor select option. */
export function matchTutorName(
  ...names: Array<string | null | undefined>
): { notionTutor: string | null; tutorUnmatched: boolean } {
  for (const rawName of names) {
    if (!rawName?.trim()) continue;
    const match = matchSingleTutorName(rawName);
    if (match) {
      return { notionTutor: match, tutorUnmatched: false };
    }
  }

  const fallback = names.find((name) => name?.trim())?.trim() ?? null;
  return { notionTutor: null, tutorUnmatched: !!fallback };
}

async function loadEnrollmentForCourse(
  supabase: SupabaseClient,
  userId: string,
  courseId: string
) {
  const { data } = await supabase
    .from("course_enrollments")
    .select("tutor_id, cohort_id, cohorts(name)")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (!data) {
    return {
      tutorDisplayName: null as string | null,
      tutorFullName: null as string | null,
      cohortName: null as string | null,
    };
  }

  let tutorDisplayName: string | null = null;
  let tutorFullName: string | null = null;
  if (data.tutor_id) {
    const { data: tutorProfile } = await supabase
      .from("profiles")
      .select("full_name, preferred_name")
      .eq("id", data.tutor_id)
      .maybeSingle();
    tutorDisplayName = tutorProfile ? getDisplayName(tutorProfile) : null;
    tutorFullName = tutorProfile?.full_name?.trim() || tutorDisplayName;
  }

  const cohortRaw = data.cohorts as { name: string } | { name: string }[] | null;
  const cohortName = Array.isArray(cohortRaw)
    ? cohortRaw[0]?.name ?? null
    : cohortRaw?.name ?? null;

  return { tutorDisplayName, tutorFullName, cohortName };
}

async function resolvePrimaryCourseId(
  supabase: SupabaseClient,
  userId: string
): Promise<{ courseId: string; tier: string } | null> {
  const { data: accessRows } = await supabase
    .from("course_access")
    .select("course_id, courses(required_tier)")
    .eq("user_id", userId);

  const tiers = (accessRows ?? [])
    .map((row) => {
      const course = Array.isArray(row.courses) ? row.courses[0] : row.courses;
      return {
        courseId: row.course_id as string,
        tier: (course as { required_tier: string } | null)?.required_tier ?? "foundational",
      };
    })
    .filter((row) => row.courseId);

  const priority = ["beginners", "foundational", "community"];
  for (const tier of priority) {
    const match = tiers.find((row) => row.tier === tier);
    if (match) return match;
  }

  return tiers[0] ?? null;
}

export async function loadFeedbackContext(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  options?: {
    lessonId?: string | null;
    phone?: string | null;
    formVariant?: Extract<FeedbackFormVariant, "week1">;
  }
): Promise<FeedbackContext> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, preferred_name")
    .eq("id", userId)
    .maybeSingle();

  const fullName = getDisplayName(profile) ?? email.split("@")[0] ?? "Learner";

  let course: NotionCourseOption = "Community";
  let lessonNumber: number | null = null;
  let lessonId: string | null = options?.lessonId ?? null;
  let cohortName: string | null = null;
  let tutorDisplayName: string | null = null;
  let tutorFullName: string | null = null;

  if (lessonId) {
    const { data: lesson } = await supabase
      .from("lessons")
      .select("id, lesson_number, course_id, courses(required_tier)")
      .eq("id", lessonId)
      .maybeSingle();

    if (lesson) {
      lessonNumber = lesson.lesson_number;
      const courseRow = Array.isArray(lesson.courses) ? lesson.courses[0] : lesson.courses;
      course = courseOptionFromTier(
        (courseRow as { required_tier: string } | null)?.required_tier
      );

      const enrollment = await loadEnrollmentForCourse(
        supabase,
        userId,
        lesson.course_id
      );
      tutorDisplayName = enrollment.tutorDisplayName;
      tutorFullName = enrollment.tutorFullName;
      cohortName = enrollment.cohortName;
    }
  } else {
    const primary = await resolvePrimaryCourseId(supabase, userId);
    if (primary) {
      course = courseOptionFromTier(primary.tier);
      const enrollment = await loadEnrollmentForCourse(
        supabase,
        userId,
        primary.courseId
      );
      tutorDisplayName = enrollment.tutorDisplayName;
      tutorFullName = enrollment.tutorFullName;
      cohortName = enrollment.cohortName;
    }
    lessonId = null;
    lessonNumber = null;
  }

  const { notionTutor, tutorUnmatched } = matchTutorName(
    tutorFullName,
    tutorDisplayName
  );
  const formVariant =
    options?.formVariant === "week1" && isWeek1BaselineForm(course, lessonNumber)
      ? "week1"
      : isWeek12FeedbackForm(course, lessonNumber)
        ? "week12"
        : "standard";

  return {
    fullName,
    email,
    phone: options?.phone?.trim() || null,
    cohort: cohortLabel(cohortName),
    course,
    lessonLabel: lessonLabelFor(course, lessonNumber),
    lessonNumber,
    tutor: tutorDisplayName,
    notionTutor,
    tutorUnmatched,
    lessonId,
    sessionId: null,
    formVariant,
  };
}

export function isNotionCourseOption(value: string): value is NotionCourseOption {
  return (NOTION_COURSE_OPTIONS as readonly string[]).includes(value);
}
