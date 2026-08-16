import "server-only";

import { actorFilter, resolveCourseActor } from "@/lib/kids/course-actor";
import { LEARN_COURSE_LEVELS } from "@/lib/learn/course-levels";
import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export const CERTIFICATE_FOUNDER_NAME = "Gurupma Singh";

export type BeginnerCertificateAward = {
  studentName: string;
  courseTitle: string;
  cefr: string;
  awardedOn: string;
  tutorName: string;
  founderName: string;
};

type CourseRow = {
  id: string;
  name: string;
  required_tier: string | null;
  content_track: string | null;
};

function officialName(profile: {
  full_name?: string | null;
  preferred_name?: string | null;
} | null): string | null {
  const full = profile?.full_name?.trim();
  if (full) return full;
  return getDisplayName(profile);
}

function formatAwardDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function isBeginnerCertificateCourse(course: CourseRow, isKid: boolean): boolean {
  if (isKid) {
    return course.content_track === "kids" || /kids.*beginner/i.test(course.name);
  }
  if (course.required_tier === "beginners") return true;
  return /beginner/i.test(course.name) && !/kids/i.test(course.name);
}

export async function loadCertificateStudentName(
  supabase: SupabaseClient,
  user: User
): Promise<string> {
  const award = await loadBeginnerCertificateAward(supabase, user);
  return award.studentName;
}

export async function loadBeginnerCertificateAward(
  supabase: SupabaseClient,
  user: User
): Promise<BeginnerCertificateAward> {
  const actor = await resolveCourseActor(supabase, user.id);
  const filter = actorFilter(actor);
  const beginner = LEARN_COURSE_LEVELS.beginners;
  const isKid = actor.kind === "kid";

  const studentNamePromise = (async () => {
    if (actor.kind === "kid") {
      const { data: kid } = await supabase
        .from("kid_profiles")
        .select("name")
        .eq("id", actor.kidProfileId)
        .maybeSingle();
      const kidName = kid?.name?.trim();
      if (kidName) return kidName;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, preferred_name")
      .eq("id", user.id)
      .maybeSingle();

    return officialName(profile) ?? user.email?.split("@")[0] ?? "Student";
  })();

  const [{ data: courseRows }, { data: enrollments }, { data: accessRows }] = await Promise.all([
    supabase.from("courses").select("id, name, required_tier, content_track"),
    supabase
      .from("course_enrollments")
      .select("id, course_id, tutor_id, cohort_id, created_at")
      .eq(filter.column, filter.value),
    supabase
      .from("course_access")
      .select("course_id, granted_at")
      .eq(filter.column, filter.value),
  ]);

  const courses = (courseRows ?? []) as CourseRow[];
  const beginnerCourses = courses.filter((course) => isBeginnerCertificateCourse(course, isKid));
  const beginnerCourseIds = new Set(beginnerCourses.map((course) => course.id));

  const enrollment =
    (enrollments ?? []).find((row) => beginnerCourseIds.has(row.course_id)) ?? null;

  const course =
    (enrollment ? courses.find((row) => row.id === enrollment.course_id) : null) ??
    beginnerCourses[0] ??
    null;

  let tutorId = enrollment?.tutor_id ?? null;
  if (!tutorId && enrollment?.cohort_id) {
    const { data: cohort } = await supabase
      .from("cohorts")
      .select("tutor_id")
      .eq("id", enrollment.cohort_id)
      .maybeSingle();
    tutorId = cohort?.tutor_id ?? null;
  }

  let tutorName = "";
  if (tutorId) {
    const { data: tutor } = await supabase
      .from("profiles")
      .select("full_name, preferred_name")
      .eq("id", tutorId)
      .maybeSingle();
    tutorName = officialName(tutor) ?? "";
  }

  const grantedAt =
    accessRows?.find((row) => row.course_id === course?.id)?.granted_at ??
    accessRows?.find((row) => beginnerCourseIds.has(row.course_id))?.granted_at ??
    null;

  const studentName = await studentNamePromise;

  return {
    studentName,
    courseTitle: beginner.title,
    cefr: beginner.cefr,
    awardedOn:
      formatAwardDate(enrollment?.created_at) ??
      formatAwardDate(grantedAt) ??
      new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
    tutorName: tutorName || "Course Tutor",
    founderName: CERTIFICATE_FOUNDER_NAME,
  };
}
