import type { PaidCourseTier } from "@/lib/membership/access";
import { findCoursesForTier, type CourseRecord } from "@/lib/membership/courses";
import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CourseStaffMember = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
};

export type MyTutorInfo = {
  assigned: boolean;
  tutor: CourseStaffMember | null;
  deliveryMode: "one_to_one" | "group" | null;
  cohortName: string | null;
};

export async function loadMyTutorForTier(
  supabase: SupabaseClient,
  userId: string,
  tier: Extract<PaidCourseTier, "foundational" | "beginners">,
  courses: CourseRecord[]
): Promise<MyTutorInfo | null> {
  const tierCourses = findCoursesForTier(courses, tier);
  if (tierCourses.length === 0) return null;

  const courseIds = tierCourses.map((course) => course.id);

  const { data: rows, error } = await supabase
    .from("course_enrollments")
    .select("tutor_id, delivery_mode, cohort_id, course_id")
    .eq("user_id", userId)
    .in("course_id", courseIds)
    .limit(1);

  if (error) throw error;

  const enrollment = rows?.[0] ?? null;
  if (!enrollment) {
    return { assigned: false, tutor: null, deliveryMode: null, cohortName: null };
  }

  const { data: tutorProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name, avatar_url")
    .eq("id", enrollment.tutor_id)
    .maybeSingle();

  if (profileError) throw profileError;

  let cohortName: string | null = null;
  if (enrollment.cohort_id) {
    const { data: cohort } = await supabase
      .from("cohorts")
      .select("name")
      .eq("id", enrollment.cohort_id)
      .maybeSingle();
    cohortName = cohort?.name ?? null;
  }

  return {
    assigned: true,
    tutor: tutorProfile
      ? {
          userId: tutorProfile.id,
          displayName: getDisplayName(tutorProfile) ?? "Your tutor",
          avatarUrl: tutorProfile.avatar_url,
        }
      : {
          userId: enrollment.tutor_id,
          displayName: "Your tutor",
          avatarUrl: null,
        },
    deliveryMode: enrollment.delivery_mode as MyTutorInfo["deliveryMode"],
    cohortName,
  };
}

export async function loadCommunityLeads(
  supabase: SupabaseClient
): Promise<CourseStaffMember[]> {
  const { data: roleRows, error: rolesError } = await supabase
    .from("profile_roles")
    .select("user_id")
    .eq("role", "community_lead");

  if (rolesError) throw rolesError;

  const userIds = [...new Set((roleRows ?? []).map((row) => row.user_id))];
  if (userIds.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name, avatar_url")
    .in("id", userIds);

  if (profilesError) throw profilesError;

  return (profiles ?? [])
    .map((profile) => ({
      userId: profile.id,
      displayName: getDisplayName(profile) ?? "Community lead",
      avatarUrl: profile.avatar_url,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
