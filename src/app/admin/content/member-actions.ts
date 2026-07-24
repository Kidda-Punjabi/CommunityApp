"use server";

import { requireAdminFromActions, type ActionResult } from "@/app/admin/content/actions";
import { ASSIGNABLE_STAFF_ROLES, type AppRole } from "@/lib/auth/admin-access";
import { hasAnyRole } from "@/lib/auth/profile-roles";
import { findCoursesForTier } from "@/lib/membership/courses";
import type { PaidCourseTier } from "@/lib/membership/access";
import { loadAccessTiersByUserId } from "@/lib/admin/member-access-tiers";
import { getDisplayName } from "@/lib/profile/display-name";
import { revalidatePath } from "next/cache";
import type { AdminMemberDetail, AdminMemberListItem } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

const ADMIN_PATH = "/admin/content";

function revalidateAdmin() {
  revalidatePath(ADMIN_PATH);
}

async function loadPremiumFieldsByUserId(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<
  Map<string, { membershipTier: string; subscriptionStatus: string | null }>
> {
  const map = new Map<
    string,
    { membershipTier: string; subscriptionStatus: string | null }
  >();
  if (userIds.length === 0) return map;

  const [{ data: profiles }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("id, membership_tier").in("id", userIds),
    supabase
      .from("memberships")
      .select("user_id, status, updated_at")
      .in("user_id", userIds)
      .order("updated_at", { ascending: false }),
  ]);

  for (const profile of profiles ?? []) {
    map.set(profile.id, {
      membershipTier: (profile.membership_tier as string) ?? "free",
      subscriptionStatus: null,
    });
  }

  for (const row of memberships ?? []) {
    const existing = map.get(row.user_id) ?? {
      membershipTier: "free",
      subscriptionStatus: null,
    };
    if (!existing.subscriptionStatus) {
      existing.subscriptionStatus = row.status as string;
      map.set(row.user_id, existing);
    }
  }

  return map;
}

function courseForTier(
  courses: { id: string; name: string; required_tier?: string | null }[],
  tier: PaidCourseTier
) {
  return findCoursesForTier(courses, tier)[0] ?? null;
}

export async function listAdminMembers(
  query = "",
  page = 1
): Promise<{ members: AdminMemberListItem[]; error?: string }> {
  try {
    const supabase = await requireAdminFromActions();
    const sanitized = query.trim().toLowerCase();

    if (sanitized.length >= 2) {
      const safeQuery = sanitized.replace(/[%_]/g, "");
      if (!safeQuery) return { members: [] };

      const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (authError) return { members: [], error: authError.message };

      const byId = new Map<string, AdminMemberListItem>();

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, preferred_name, avatar_url")
        .or(`full_name.ilike.%${safeQuery}%,preferred_name.ilike.%${safeQuery}%`)
        .limit(50);

      for (const profile of profiles ?? []) {
        const authUser = authData.users.find((user) => user.id === profile.id);
        byId.set(profile.id, {
          userId: profile.id,
          email: authUser?.email ?? null,
          displayName: getDisplayName(profile) ?? "Member",
          avatarUrl: profile.avatar_url,
          accessTiers: [],
          membershipTier: "free",
          subscriptionStatus: null,
        });
      }

      for (const user of authData.users) {
        if (!user.email?.toLowerCase().includes(safeQuery)) continue;
        if (byId.has(user.id)) {
          byId.get(user.id)!.email = user.email;
          continue;
        }
        const profile = profiles?.find((row) => row.id === user.id);
        byId.set(user.id, {
          userId: user.id,
          email: user.email,
          displayName: getDisplayName(profile ?? null) ?? user.email ?? "Member",
          avatarUrl: profile?.avatar_url ?? null,
          accessTiers: [],
          membershipTier: "free",
          subscriptionStatus: null,
        });
      }

      const userIds = [...byId.keys()];
      if (userIds.length === 0) return { members: [] };

      const [tiersByUser, premiumByUser] = await Promise.all([
        loadAccessTiersByUserId(supabase, userIds),
        loadPremiumFieldsByUserId(supabase, userIds),
      ]);

      for (const member of byId.values()) {
        member.accessTiers = [...(tiersByUser.get(member.userId) ?? [])];
        const premium = premiumByUser.get(member.userId);
        member.membershipTier = premium?.membershipTier ?? "free";
        member.subscriptionStatus = premium?.subscriptionStatus ?? null;
      }

      return { members: [...byId.values()].slice(0, 50) };
    }

    const perPage = 50;
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (authError) return { members: [], error: authError.message };

    const users = authData.users;
    const userIds = users.map((user) => user.id);
    if (userIds.length === 0) return { members: [] };

    const [{ data: profiles }, tiersByUser, premiumByUser] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, preferred_name, avatar_url")
        .in("id", userIds),
      loadAccessTiersByUserId(supabase, userIds),
      loadPremiumFieldsByUserId(supabase, userIds),
    ]);

    const profileById = new Map((profiles ?? []).map((row) => [row.id, row] as const));

    const members: AdminMemberListItem[] = users.map((user) => {
      const profile = profileById.get(user.id);
      const premium = premiumByUser.get(user.id);
      return {
        userId: user.id,
        email: user.email ?? null,
        displayName: getDisplayName(profile ?? null) ?? user.email ?? "Member",
        avatarUrl: profile?.avatar_url ?? null,
        accessTiers: [...(tiersByUser.get(user.id) ?? [])],
        membershipTier: premium?.membershipTier ?? "free",
        subscriptionStatus: premium?.subscriptionStatus ?? null,
      };
    });

    return { members };
  } catch (e) {
    return {
      members: [],
      error: e instanceof Error ? e.message : "Failed to load members.",
    };
  }
}

export async function loadAdminMemberDetail(
  userId: string
): Promise<{ detail: AdminMemberDetail | null; error?: string }> {
  try {
    if (!userId) return { detail: null, error: "Member id is required." };

    const supabase = await requireAdminFromActions();

    const [
      { data: authUser, error: authError },
      { data: profile },
      { data: accessRows },
      { data: enrollmentRows },
      { data: courses },
      { data: cohortMemberRows },
      { data: membership },
    ] = await Promise.all([
      supabase.auth.admin.getUserById(userId),
      supabase
        .from("profiles")
        .select("id, full_name, preferred_name, avatar_url, membership_tier")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("course_access").select("course_id").eq("user_id", userId),
      supabase
        .from("course_enrollments")
        .select("id, course_id, tutor_id, delivery_mode, cohort_id, courses(required_tier)")
        .eq("user_id", userId),
      supabase.from("courses").select("id, name, required_tier"),
      supabase
        .from("cohort_members")
        .select("cohort_id, cohorts(id, name)")
        .eq("user_id", userId)
        .is("left_at", null),
      supabase
        .from("memberships")
        .select("status, stripe_subscription_id, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (authError) return { detail: null, error: authError.message };

    const accessCourseIds = new Set((accessRows ?? []).map((row) => row.course_id));
    const courseList = courses ?? [];

    const hasTierAccess = (tier: PaidCourseTier) => {
      const course = courseForTier(courseList, tier);
      return course ? accessCourseIds.has(course.id) : false;
    };

    const tutorIds = [
      ...new Set((enrollmentRows ?? []).map((row) => row.tutor_id).filter(Boolean)),
    ] as string[];

    const { data: tutorProfiles } =
      tutorIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, full_name, preferred_name")
            .in("id", tutorIds)
        : { data: [] };

    const tutorLabelById = new Map(
      (tutorProfiles ?? []).map((row) => [
        row.id,
        getDisplayName(row) ?? row.id.slice(0, 8),
      ] as const)
    );

    const foundationalCourse = courseForTier(courseList, "foundational");
    const beginnersCourse = courseForTier(courseList, "beginners");
    const communityCourse = courseForTier(courseList, "community");

    const foundationalEnrollment = (enrollmentRows ?? []).find((row) => {
      const course = Array.isArray(row.courses) ? row.courses[0] : row.courses;
      return course?.required_tier === "foundational";
    });

    const beginnersEnrollment = (enrollmentRows ?? []).find((row) => {
      const course = Array.isArray(row.courses) ? row.courses[0] : row.courses;
      return course?.required_tier === "beginners";
    });

    const activeCohorts = (cohortMemberRows ?? []).map((row) => {
      const cohort = Array.isArray(row.cohorts) ? row.cohorts[0] : row.cohorts;
      return {
        cohortId: row.cohort_id,
        cohortName: cohort?.name ?? "Cohort",
      };
    });

    return {
      detail: {
        userId,
        email: authUser.user.email ?? null,
        displayName:
          getDisplayName(profile ?? null) ?? authUser.user.email ?? "Member",
        avatarUrl: profile?.avatar_url ?? null,
        membershipTier: (profile?.membership_tier as string) ?? "free",
        subscriptionStatus: (membership?.status as string) ?? null,
        stripeSubscriptionId: membership?.stripe_subscription_id ?? null,
        courseAccess: {
          foundational: hasTierAccess("foundational"),
          beginners: hasTierAccess("beginners"),
          community: hasTierAccess("community"),
        },
        courseIds: {
          foundational: foundationalCourse?.id ?? null,
          beginners: beginnersCourse?.id ?? null,
          community: communityCourse?.id ?? null,
        },
        foundationalEnrollment: foundationalEnrollment
          ? {
              enrollmentId: foundationalEnrollment.id,
              tutorId: foundationalEnrollment.tutor_id,
              tutorLabel: tutorLabelById.get(foundationalEnrollment.tutor_id) ?? null,
            }
          : null,
        beginnersEnrollment: beginnersEnrollment
          ? {
              enrollmentId: beginnersEnrollment.id,
              tutorId: beginnersEnrollment.tutor_id,
              tutorLabel: tutorLabelById.get(beginnersEnrollment.tutor_id) ?? null,
              deliveryMode: beginnersEnrollment.delivery_mode as
                | "one_to_one"
                | "group"
                | null,
              cohortId: beginnersEnrollment.cohort_id,
            }
          : null,
        activeCohorts,
      },
    };
  } catch (e) {
    return {
      detail: null,
      error: e instanceof Error ? e.message : "Failed to load member.",
    };
  }
}

async function ensureCohortMember(
  supabase: Awaited<ReturnType<typeof requireAdminFromActions>>,
  cohortId: string,
  userId: string
) {
  const { error } = await supabase.from("cohort_members").upsert(
    {
      cohort_id: cohortId,
      user_id: userId,
      joined_at: new Date().toISOString(),
      left_at: null,
    },
    { onConflict: "cohort_id,user_id" }
  );
  if (error) throw new Error(error.message);
}

async function validateTutor(
  supabase: Awaited<ReturnType<typeof requireAdminFromActions>>,
  tutorId: string
) {
  const { data: tutorRoles, error } = await supabase
    .from("profile_roles")
    .select("role")
    .eq("user_id", tutorId);

  if (error) throw new Error(error.message);

  const roleList = (tutorRoles ?? []).map((row) => row.role as AppRole);
  if (!hasAnyRole(roleList, [...ASSIGNABLE_STAFF_ROLES])) {
    throw new Error(
      "Selected staff must have tutor, community lead, and/or master admin role."
    );
  }
}

export async function saveMemberCourseAccess(
  userId: string,
  courseId: string,
  hasAccess: boolean
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    if (!userId || !courseId) return { error: "Member and course are required." };

    if (hasAccess) {
      const { error } = await supabase.from("course_access").upsert(
        {
          user_id: userId,
          course_id: courseId,
          granted_at: new Date().toISOString(),
        },
        { onConflict: "user_id,course_id" }
      );
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase
        .from("course_access")
        .delete()
        .eq("user_id", userId)
        .eq("course_id", courseId);
      if (error) return { error: error.message };
    }

    revalidateAdmin();
    return { success: hasAccess ? "Course access granted." : "Course access removed." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update access." };
  }
}

export async function saveMemberFoundationalSetup(
  userId: string,
  courseId: string,
  hasAccess: boolean,
  tutorId: string | null
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const accessResult = await saveMemberCourseAccess(userId, courseId, hasAccess);
    if (accessResult.error) return accessResult;

    if (!tutorId) {
      await supabase
        .from("course_enrollments")
        .delete()
        .eq("user_id", userId)
        .eq("course_id", courseId);
      revalidateAdmin();
      return { success: "Foundational access saved." };
    }

    await validateTutor(supabase, tutorId);

    const { error } = await supabase.from("course_enrollments").upsert(
      {
        user_id: userId,
        course_id: courseId,
        tutor_id: tutorId,
        delivery_mode: null,
        cohort_id: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,course_id" }
    );
    if (error) return { error: error.message };

    revalidateAdmin();
    return { success: "Foundational access and tutor saved." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save foundational setup." };
  }
}

export async function saveMemberBeginnersSetup(
  userId: string,
  courseId: string,
  hasAccess: boolean,
  tutorId: string | null,
  deliveryMode: "" | "one_to_one" | "group",
  cohortId: string | null
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const accessResult = await saveMemberCourseAccess(userId, courseId, hasAccess);
    if (accessResult.error) return accessResult;

    if (!tutorId) {
      await supabase
        .from("course_enrollments")
        .delete()
        .eq("user_id", userId)
        .eq("course_id", courseId);
      revalidateAdmin();
      return { success: "Beginners access saved." };
    }

    if (deliveryMode !== "one_to_one" && deliveryMode !== "group") {
      return { error: "Choose 1-1 or group delivery for Beginners." };
    }

    if (deliveryMode === "group") {
      if (!cohortId) return { error: "Select a cohort for group delivery." };
      await ensureCohortMember(supabase, cohortId, userId);
    }

    await validateTutor(supabase, tutorId);

    const { error } = await supabase.from("course_enrollments").upsert(
      {
        user_id: userId,
        course_id: courseId,
        tutor_id: tutorId,
        delivery_mode: deliveryMode,
        cohort_id: deliveryMode === "group" ? cohortId : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,course_id" }
    );
    if (error) return { error: error.message };

    revalidateAdmin();
    return { success: "Beginners access and tutor saved." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save beginners setup." };
  }
}

export async function saveMemberCommunityAccess(
  userId: string,
  courseId: string,
  hasAccess: boolean
): Promise<ActionResult> {
  return saveMemberCourseAccess(userId, courseId, hasAccess);
}
