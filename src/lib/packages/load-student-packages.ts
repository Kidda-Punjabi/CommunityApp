import type { LearnTrackId } from "@/lib/learning/learn-catalog";
import type { PaidCourseTier } from "@/lib/membership/access";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { loadStudentUpcomingSessions } from "@/lib/calendar/load-sessions";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
import { loadCommunityLeads } from "@/lib/tutoring/load-course-staff";
import {
  packageSlugForEnrollment,
  PACKAGE_CATALOG,
  type PackageCatalogEntry,
} from "@/lib/packages/catalog";
import { getDisplayName } from "@/lib/profile/display-name";
import { actorFilter, resolveCourseActor } from "@/lib/kids/course-actor";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type StudentPackageStatus = "active" | "pending_setup" | "content_only";

export type StudentPackageSession = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  meetLink: string | null;
  whenLabel: string;
};

export type StudentPackage = {
  slug: string;
  name: string;
  description: string;
  learnTrackId: LearnTrackId;
  tier: PaidCourseTier;
  courseId: string;
  status: StudentPackageStatus;
  purchasedAt: string | null;
  enrollmentId: string | null;
  includesLiveSessions: boolean;
  deliveryMode: "one_to_one" | "group" | null;
  tutorName: string | null;
  tutorAvatarUrl: string | null;
  /** Shown when no tutor is assigned — first community lead by display name (alphabetical). */
  communityLeadName: string | null;
  communityLeadAvatarUrl: string | null;
  cohortId: string | null;
  cohortName: string | null;
  nextSession: StudentPackageSession | null;
  upcomingSessionCount: number;
};

type EnrollmentRow = {
  id: string;
  course_id: string;
  tutor_id: string;
  delivery_mode: "one_to_one" | "group" | null;
  cohort_id: string | null;
};

function sessionBelongsToPackage(
  session: {
    tutor_id: string;
    student_id: string | null;
    cohort_id: string | null;
    course_id: string | null;
  },
  userId: string,
  enrollment: EnrollmentRow | null,
  courseId: string
): boolean {
  if (session.course_id && session.course_id === courseId) return true;
  if (!enrollment) return false;
  if (session.tutor_id !== enrollment.tutor_id) return false;

  if (enrollment.delivery_mode === "group" && enrollment.cohort_id) {
    return session.cohort_id === enrollment.cohort_id;
  }

  return session.student_id === userId;
}

function resolveCatalogEntry(
  tier: PaidCourseTier,
  enrollment: EnrollmentRow | null,
  purchasedPackageSlug: string | null
): PackageCatalogEntry {
  if (purchasedPackageSlug) {
    const fromPurchase = getPackageCatalogEntryBySlug(purchasedPackageSlug);
    if (fromPurchase) return fromPurchase;
  }

  if (tier === "beginners" && !enrollment) {
    return (
      PACKAGE_CATALOG.find((entry) => entry.slug === "beginners-1-1") ??
      PACKAGE_CATALOG.find((entry) => entry.tier === "beginners")!
    );
  }

  const slug = packageSlugForEnrollment(
    tier,
    enrollment?.delivery_mode === "group"
      ? "group"
      : enrollment?.delivery_mode === "one_to_one"
        ? "one_to_one"
        : null
  );

  return getPackageCatalogEntryBySlug(slug) ?? PACKAGE_CATALOG[0];
}

function getPackageCatalogEntryBySlug(slug: string): PackageCatalogEntry | undefined {
  return PACKAGE_CATALOG.find((entry) => entry.slug === slug);
}

function packageStatus(
  catalog: PackageCatalogEntry,
  enrollment: EnrollmentRow | null
): StudentPackageStatus {
  if (!catalog.includesLiveSessions) return "content_only";
  if (!enrollment?.tutor_id) return "pending_setup";
  if (catalog.tier === "beginners" && catalog.deliveryMode === "group" && !enrollment.cohort_id) {
    return "pending_setup";
  }
  return "active";
}

export async function loadStudentPackages(
  supabase: SupabaseClient,
  user: User
): Promise<StudentPackage[]> {
  const [access, sessionLoad, communityLeads] = await Promise.all([
    getCourseAccessContext(supabase, user),
    loadStudentUpcomingSessions(supabase, user.id, user.email),
    loadCommunityLeads(supabase),
  ]);

  if (access.unlockedCourseIds.size === 0) return [];

  const actor = await resolveCourseActor(supabase, user.id);
  const filter = actorFilter(actor);
  const unlockedCourseIds = [...access.unlockedCourseIds];

  const [{ data: accessRows }, { data: enrollmentRows }, { data: studentPackageRows }] =
    await Promise.all([
      supabase
        .from("course_access")
        .select("course_id, granted_at")
        .eq(filter.column, filter.value)
        .in("course_id", unlockedCourseIds),
      supabase
        .from("course_enrollments")
        .select("id, course_id, tutor_id, delivery_mode, cohort_id")
        .eq(filter.column, filter.value)
        .in("course_id", unlockedCourseIds),
      supabase
        .from("student_packages")
        .select("course_id, packages(slug)")
        .eq(filter.column, filter.value)
        .in("course_id", unlockedCourseIds),
    ]);

  const purchasedSlugByCourseId = new Map<string, string>();
  for (const row of studentPackageRows ?? []) {
    const pkg = Array.isArray(row.packages) ? row.packages[0] : row.packages;
    const slug = pkg && typeof pkg === "object" && "slug" in pkg ? String(pkg.slug) : null;
    if (slug && row.course_id) purchasedSlugByCourseId.set(row.course_id, slug);
  }

  const enrollmentByCourseId = new Map(
    (enrollmentRows ?? []).map((row) => [row.course_id, row as EnrollmentRow])
  );

  const tutorIds = [
    ...new Set(
      (enrollmentRows ?? []).map((row) => row.tutor_id).filter((id): id is string => Boolean(id))
    ),
  ];
  const cohortIds = [
    ...new Set(
      (enrollmentRows ?? [])
        .map((row) => row.cohort_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const [{ data: tutors }, { data: cohorts }] = await Promise.all([
    tutorIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, preferred_name, avatar_url")
          .in("id", tutorIds)
      : Promise.resolve({ data: [] }),
    cohortIds.length > 0
      ? supabase.from("cohorts").select("id, name").in("id", cohortIds)
      : Promise.resolve({ data: [] }),
  ]);

  const tutorById = new Map(
    (tutors ?? []).map((tutor) => [tutor.id, getDisplayName(tutor) ?? "Your tutor"])
  );
  const tutorAvatarById = new Map(
    (tutors ?? []).map((tutor) => [tutor.id, tutor.avatar_url ?? null])
  );
  const cohortNameById = new Map((cohorts ?? []).map((cohort) => [cohort.id, cohort.name]));

  const packages: StudentPackage[] = [];

  for (const accessRow of accessRows ?? []) {
    const course = access.courses.find((row) => row.id === accessRow.course_id);
    if (!course?.required_tier || course.required_tier === "free") continue;

    const purchasedSlug = purchasedSlugByCourseId.get(accessRow.course_id) ?? null;
    const catalogTier: PaidCourseTier =
      course.required_tier === "foundational" ||
      course.required_tier === "beginners" ||
      course.required_tier === "community"
        ? course.required_tier
        : "beginners";
    const enrollment = enrollmentByCourseId.get(accessRow.course_id) ?? null;
    const catalog = resolveCatalogEntry(catalogTier, enrollment, purchasedSlug);
    const status = packageStatus(catalog, enrollment);

    const packageSessions = sessionLoad.sessions
      .filter((session) =>
        sessionBelongsToPackage(session, user.id, enrollment, accessRow.course_id)
      )
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

    const next = packageSessions[0] ?? null;

    const tutorName = enrollment?.tutor_id ? (tutorById.get(enrollment.tutor_id) ?? null) : null;
    const tutorAvatarUrl = enrollment?.tutor_id
      ? (tutorAvatarById.get(enrollment.tutor_id) ?? null)
      : null;
    const fallbackLead = communityLeads[0] ?? null;

    packages.push({
      slug: catalog.slug,
      name: catalog.name,
      description: catalog.description,
      learnTrackId: catalog.learnTrackId,
      tier: catalog.tier,
      courseId: accessRow.course_id,
      status,
      purchasedAt: accessRow.granted_at ?? null,
      enrollmentId: enrollment?.id ?? null,
      includesLiveSessions: catalog.includesLiveSessions,
      deliveryMode:
        enrollment?.delivery_mode === "group" || enrollment?.delivery_mode === "one_to_one"
          ? enrollment.delivery_mode
          : catalog.deliveryMode,
      tutorName,
      tutorAvatarUrl,
      communityLeadName: !tutorName && fallbackLead ? fallbackLead.displayName : null,
      communityLeadAvatarUrl: !tutorName && fallbackLead ? fallbackLead.avatarUrl : null,
      cohortId: enrollment?.cohort_id ?? null,
      cohortName: enrollment?.cohort_id
        ? (cohortNameById.get(enrollment.cohort_id) ?? null)
        : null,
      nextSession: next
        ? {
            id: next.id,
            title: next.title,
            startsAt: next.starts_at,
            endsAt: next.ends_at,
            meetLink: next.meet_link,
            whenLabel: formatSessionWhen(next.starts_at, next.ends_at),
          }
        : null,
      upcomingSessionCount: packageSessions.length,
    });
  }

  return packages.sort((a, b) => {
    const order = PACKAGE_CATALOG.map((entry) => entry.slug);
    return order.indexOf(a.slug) - order.indexOf(b.slug);
  });
}

export function findStudentPackageForTrack(
  packages: StudentPackage[],
  trackId: LearnTrackId
): StudentPackage | null {
  const matches = packages.filter((pkg) => pkg.learnTrackId === trackId);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  return matches.find((pkg) => pkg.status === "active") ?? matches[0];
}
