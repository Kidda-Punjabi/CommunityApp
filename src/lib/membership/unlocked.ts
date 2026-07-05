import {
  inferCourseTier,
  normalizeTier,
  TIER_LABELS,
  type MembershipTier,
} from "./tiers";
import {
  courseIdsForTiers,
  courseNamesForIds,
  fetchCourses,
  type CourseRecord,
} from "./courses";
import { getCourseRequiredTier, type PaidCourseTier } from "./access";
import {
  formatViewAsLabel,
  parseViewAsCookie,
  VIEW_AS_COOKIE,
} from "./view-as";
import { isAdmin } from "@/lib/auth/admin";
import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export type CourseAccessContext = {
  unlockedCourseIds: Set<string>;
  courses: CourseRecord[];
  isFreeOnly: boolean;
  viewAs: {
    active: boolean;
    label: string;
    tiers: PaidCourseTier[];
  } | null;
};

export async function getUserUnlockedCourseIds(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<string>> {
  const { data: rows } = await supabase
    .from("course_access")
    .select("course_id")
    .eq("user_id", userId);

  return new Set((rows ?? []).map((row) => row.course_id));
}

async function readViewAsState(user: User | null) {
  if (!isAdmin(user)) return { mode: "real" as const };
  const cookieStore = await cookies();
  return parseViewAsCookie(cookieStore.get(VIEW_AS_COOKIE)?.value);
}

export async function getCourseAccessContext(
  supabase: SupabaseClient,
  user: User
): Promise<CourseAccessContext> {
  const courses = await fetchCourses(supabase);
  const viewAsState = await readViewAsState(user);

  if (viewAsState.mode === "override") {
    const unlockedCourseIds = courseIdsForTiers(courses, viewAsState.tiers);
    return {
      unlockedCourseIds,
      courses,
      isFreeOnly: unlockedCourseIds.size === 0,
      viewAs: {
        active: true,
        label: formatViewAsLabel(viewAsState.tiers),
        tiers: viewAsState.tiers,
      },
    };
  }

  if (await canAccessAdminPanel(user, supabase)) {
    return {
      unlockedCourseIds: new Set(courses.map((course) => course.id)),
      courses,
      isFreeOnly: false,
      viewAs: null,
    };
  }

  const unlockedCourseIds = await getUserUnlockedCourseIds(supabase, user.id);

  return {
    unlockedCourseIds,
    courses,
    isFreeOnly: unlockedCourseIds.size === 0,
    viewAs: null,
  };
}

export function tiersFromUnlockedCourses(
  courses: CourseRecord[],
  unlockedCourseIds: Set<string>
): PaidCourseTier[] {
  const tiers = new Set<PaidCourseTier>();

  for (const course of courses) {
    if (unlockedCourseIds.has(course.id)) {
      tiers.add(getCourseRequiredTier(course));
    }
  }

  return [...tiers];
}

export function formatUnlockedCourseNames(
  courses: CourseRecord[],
  unlockedCourseIds: Set<string>
): string {
  if (unlockedCourseIds.size === 0) {
    return TIER_LABELS.free;
  }

  const names = courseNamesForIds(courses, unlockedCourseIds);
  return names.length > 0 ? names.join(", ") : TIER_LABELS.free;
}

/** Human-readable membership line for profile Account card. */
export function formatMembershipPlanLabel(
  courses: CourseRecord[],
  unlockedCourseIds: Set<string>
): string {
  if (unlockedCourseIds.size === 0) {
    return "Free plan";
  }

  const names = courseNamesForIds(courses, unlockedCourseIds);
  if (names.length === 0) return "Free plan";

  const shortNames = names.map((name) =>
    name
      .replace(/\s+course$/i, "")
      .replace(/\s+plan$/i, "")
      .trim()
  );

  if (shortNames.length === 1) {
    return `${shortNames[0]} plan`;
  }

  return `${shortNames.join(" · ")} plan`;
}

/** @deprecated Use formatUnlockedCourseNames with course IDs */
export function formatUnlockedCourses(unlockedTiers: Set<PaidCourseTier>): string {
  if (unlockedTiers.size === 0) {
    return TIER_LABELS.free;
  }

  return Array.from(unlockedTiers)
    .map((tier) => TIER_LABELS[tier])
    .join(", ");
}

export function isPaidCourseTier(tier: MembershipTier): tier is PaidCourseTier {
  return tier !== "free";
}

export function tierLabelForCourse(
  courses: CourseRecord[],
  courseId: string
): string {
  const course = courses.find((item) => item.id === courseId);
  if (!course) return TIER_LABELS.foundational;

  const tier = course.required_tier
    ? normalizeTier(course.required_tier)
    : inferCourseTier(course.name);

  return tier !== "free" ? TIER_LABELS[tier] : course.name;
}
