"use server";

import { requireAdminFromActions, type ActionResult } from "@/app/admin/content/actions";
import { ASSIGNABLE_STAFF_ROLES, APP_ROLE_LABELS, type AppRole } from "@/lib/auth/admin-access";
import { hasAnyRole } from "@/lib/auth/profile-roles";
import { getDisplayName } from "@/lib/profile/display-name";
import { revalidatePath } from "next/cache";
import type {
  AdminCohort,
  AdminEnrollment,
  AdminStaffMember,
} from "./types";

const ADMIN_PATH = "/admin/content";

function revalidateAdmin() {
  revalidatePath(ADMIN_PATH);
}

const STAFF_ROLES: AppRole[] = [...ASSIGNABLE_STAFF_ROLES];

export async function setUserAppRoles(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const userId = String(formData.get("user_id") ?? "").trim();
    const roles = formData
      .getAll("app_roles")
      .map((value) => String(value).trim() as AppRole)
      .filter((role) => STAFF_ROLES.includes(role));

    if (!userId) return { error: "Select a member." };

    const uniqueRoles = [...new Set(roles)];

    const { error: deleteError } = await supabase
      .from("profile_roles")
      .delete()
      .eq("user_id", userId);

    if (deleteError) return { error: deleteError.message };

    if (uniqueRoles.length > 0) {
      const { error: insertError } = await supabase.from("profile_roles").insert(
        uniqueRoles.map((role) => ({
          user_id: userId,
          role,
        }))
      );

      if (insertError) return { error: insertError.message };
    }

    revalidateAdmin();
    return {
      success:
        uniqueRoles.length > 0
          ? `Roles updated: ${uniqueRoles.map((role) => APP_ROLE_LABELS[role]).join(", ")}.`
          : "All staff roles removed — user is now a member.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update roles." };
  }
}

export async function assignCourseEnrollment(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const studentId = String(formData.get("student_id") ?? "").trim();
    const tutorId = String(formData.get("tutor_id") ?? "").trim();
    const courseId = String(formData.get("course_id") ?? "").trim();
    const deliveryModeRaw = String(formData.get("delivery_mode") ?? "").trim();
    const cohortId = String(formData.get("cohort_id") ?? "").trim() || null;

    if (!studentId || !tutorId || !courseId) {
      return { error: "Student, tutor, and course are required." };
    }

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id, name, required_tier")
      .eq("id", courseId)
      .maybeSingle();

    if (courseError) return { error: courseError.message };
    if (!course) return { error: "Course not found." };

    const tier = course.required_tier ?? "";
    if (tier === "community") {
      return { error: "Community course does not use tutor enrollments." };
    }

    const { data: tutorRoles, error: tutorRolesError } = await supabase
      .from("profile_roles")
      .select("role")
      .eq("user_id", tutorId);

    if (tutorRolesError) return { error: tutorRolesError.message };

    const roleList = (tutorRoles ?? []).map((row) => row.role as AppRole);
    if (!hasAnyRole(roleList, [...ASSIGNABLE_STAFF_ROLES])) {
      return {
        error: "Selected staff must have tutor, community lead, and/or master admin role.",
      };
    }

    let deliveryMode: "one_to_one" | "group" | null = null;

    if (tier === "foundational") {
      deliveryMode = null;
    } else if (tier === "beginners") {
      if (deliveryModeRaw !== "one_to_one" && deliveryModeRaw !== "group") {
        return { error: "Choose a delivery mode for Beginners." };
      }
      deliveryMode = deliveryModeRaw;

      if (deliveryMode === "group") {
        if (!cohortId) return { error: "Select a cohort for group delivery." };

        const { data: membership } = await supabase
          .from("cohort_members")
          .select("cohort_id")
          .eq("cohort_id", cohortId)
          .eq("user_id", studentId)
          .is("left_at", null)
          .maybeSingle();

        if (!membership) {
          return { error: "Student must be an active member of the selected cohort." };
        }
      }
    } else {
      return { error: "Tutor assignment is only for Foundational and Beginners courses." };
    }

    const payload = {
      user_id: studentId,
      course_id: courseId,
      tutor_id: tutorId,
      delivery_mode: deliveryMode,
      cohort_id: deliveryMode === "group" ? cohortId : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("course_enrollments")
      .upsert(payload, { onConflict: "user_id,course_id" });

    if (error) return { error: error.message };

    revalidateAdmin();
    return { success: "Tutor assignment saved." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to assign tutor." };
  }
}

export async function removeCourseEnrollment(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const enrollmentId = String(formData.get("enrollment_id") ?? "").trim();
    if (!enrollmentId) return { error: "Enrollment id is required." };

    const { error } = await supabase
      .from("course_enrollments")
      .delete()
      .eq("id", enrollmentId);

    if (error) return { error: error.message };

    revalidateAdmin();
    return { success: "Enrollment removed." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to remove enrollment." };
  }
}

export async function createBeginnersCohort(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const courseId = String(formData.get("course_id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const tutorId = String(formData.get("tutor_id") ?? "").trim() || null;

    if (!courseId || !name) return { error: "Course and cohort name are required." };

    const { data: course } = await supabase
      .from("courses")
      .select("required_tier, content_track")
      .eq("id", courseId)
      .maybeSingle();

    if (course?.required_tier !== "beginners" && course?.content_track !== "kids") {
      return { error: "Cohorts are only for Beginners and kids courses." };
    }

    const { error } = await supabase.from("cohorts").insert({
      course_id: courseId,
      name,
      tutor_id: tutorId,
    });

    if (error) return { error: error.message };

    revalidateAdmin();
    return { success: `Cohort “${name}” created.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create cohort." };
  }
}

export async function addCohortMember(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const cohortId = String(formData.get("cohort_id") ?? "").trim();
    const userId = String(formData.get("user_id") ?? "").trim();

    if (!cohortId || !userId) return { error: "Cohort and member are required." };

    const { error } = await supabase.from("cohort_members").upsert(
      {
        cohort_id: cohortId,
        user_id: userId,
        joined_at: new Date().toISOString(),
        left_at: null,
      },
      { onConflict: "cohort_id,user_id" }
    );

    if (error) return { error: error.message };

    revalidateAdmin();
    return { success: "Member added to cohort." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add cohort member." };
  }
}

export async function removeCohortMember(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const cohortId = String(formData.get("cohort_id") ?? "").trim();
    const userId = String(formData.get("user_id") ?? "").trim();

    if (!cohortId || !userId) return { error: "Cohort and member are required." };

    const { error } = await supabase
      .from("cohort_members")
      .update({ left_at: new Date().toISOString() })
      .eq("cohort_id", cohortId)
      .eq("user_id", userId)
      .is("left_at", null);

    if (error) return { error: error.message };

    revalidateAdmin();
    return { success: "Member removed from cohort." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to remove cohort member." };
  }
}

export async function removeCourseEnrollmentForm(formData: FormData): Promise<void> {
  await removeCourseEnrollment({}, formData);
}

export async function removeCohortMemberForm(formData: FormData): Promise<void> {
  await removeCohortMember({}, formData);
}

export async function loadStaffProfilesForAdmin(): Promise<StaffProfileRow[]> {
  const supabase = await requireAdminFromActions();

  const { data: roleRows, error: rolesError } = await supabase
    .from("profile_roles")
    .select("user_id, role");

  if (rolesError) throw new Error(rolesError.message);

  const rolesByUser = new Map<string, AppRole[]>();
  for (const row of roleRows ?? []) {
    const list = rolesByUser.get(row.user_id) ?? [];
    list.push(row.role as AppRole);
    rolesByUser.set(row.user_id, list);
  }

  const userIds = [...rolesByUser.keys()];
  if (userIds.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name")
    .in("id", userIds);

  if (profilesError) throw new Error(profilesError.message);

  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authError) throw new Error(authError.message);

  const emailById = new Map(
    authData.users.map((user) => [user.id, user.email ?? null] as const)
  );

  return (profiles ?? [])
    .map((profile) => ({
      userId: profile.id,
      email: emailById.get(profile.id) ?? null,
      displayName: getDisplayName(profile) ?? emailById.get(profile.id) ?? "Member",
      appRoles: rolesByUser.get(profile.id) ?? [],
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export type StaffProfileRow = {
  userId: string;
  email: string | null;
  displayName: string;
  appRoles: AppRole[];
};

export async function loadAdminTutorPanelData(): Promise<{
  enrollments: AdminEnrollment[];
  cohorts: AdminCohort[];
  staffMembers: AdminStaffMember[];
  errors: { enrollments?: string; cohorts?: string; staffMembers?: string };
}> {
  const supabase = await requireAdminFromActions();

  const errors: { enrollments?: string; cohorts?: string; staffMembers?: string } = {};

  let staffMembers: AdminStaffMember[] = [];
  try {
    const staff = await loadStaffProfilesForAdmin();
    staffMembers = staff.map((row) => ({
      userId: row.userId,
      email: row.email,
      displayName: row.displayName,
      appRoles: row.appRoles,
    }));
  } catch (e) {
    errors.staffMembers = e instanceof Error ? e.message : "Failed to load staff.";
  }

  const { data: authData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailById = new Map(
    (authData?.users ?? []).map((user) => [user.id, user.email ?? null] as const)
  );

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name");

  const labelById = new Map(
    (profileRows ?? []).map((profile) => [
      profile.id,
      getDisplayName(profile) ?? emailById.get(profile.id) ?? profile.id.slice(0, 8),
    ] as const)
  );

  const { data: courses } = await supabase.from("courses").select("id, name, required_tier");
  const courseById = new Map((courses ?? []).map((course) => [course.id, course] as const));

  let enrollments: AdminEnrollment[] = [];
  const { data: enrollmentRows, error: enrollmentsError } = await supabase
    .from("course_enrollments")
    .select("id, user_id, course_id, tutor_id, delivery_mode, cohort_id")
    .order("created_at", { ascending: false });

  if (enrollmentsError) {
    errors.enrollments = enrollmentsError.message;
  } else {
    const cohortIds = [
      ...new Set((enrollmentRows ?? []).map((row) => row.cohort_id).filter(Boolean)),
    ] as string[];

    let cohortNameById = new Map<string, string>();
    if (cohortIds.length > 0) {
      const { data: cohortNames } = await supabase
        .from("cohorts")
        .select("id, name")
        .in("id", cohortIds);
      cohortNameById = new Map((cohortNames ?? []).map((c) => [c.id, c.name] as const));
    }

    enrollments = (enrollmentRows ?? []).map((row) => {
      const course = courseById.get(row.course_id);
      return {
        id: row.id,
        user_id: row.user_id,
        course_id: row.course_id,
        tutor_id: row.tutor_id,
        delivery_mode: row.delivery_mode,
        cohort_id: row.cohort_id,
        studentLabel: labelById.get(row.user_id) ?? "Student",
        studentEmail: emailById.get(row.user_id) ?? null,
        tutorLabel: labelById.get(row.tutor_id) ?? "Tutor",
        courseName: course?.name ?? "Course",
        courseTier: course?.required_tier ?? null,
        cohortName: row.cohort_id ? cohortNameById.get(row.cohort_id) ?? null : null,
      };
    });
  }

  let cohorts: AdminCohort[] = [];
  const { data: cohortRows, error: cohortsError } = await supabase
    .from("cohorts")
    .select("id, name, course_id, tutor_id")
    .order("name");

  if (cohortsError) {
    errors.cohorts = cohortsError.message;
  } else {
    const cohortIds = (cohortRows ?? []).map((row) => row.id);
    const { data: memberRows } =
      cohortIds.length > 0
        ? await supabase
            .from("cohort_members")
            .select("cohort_id, user_id")
            .in("cohort_id", cohortIds)
            .is("left_at", null)
        : { data: [] as { cohort_id: string; user_id: string }[] };

    const membersByCohort = new Map<string, AdminCohort["members"]>();
    for (const member of memberRows ?? []) {
      const list = membersByCohort.get(member.cohort_id) ?? [];
      list.push({
        userId: member.user_id,
        label: labelById.get(member.user_id) ?? "Member",
        email: emailById.get(member.user_id) ?? null,
      });
      membersByCohort.set(member.cohort_id, list);
    }

    cohorts = (cohortRows ?? []).map((row) => {
      const course = courseById.get(row.course_id);
      return {
        id: row.id,
        name: row.name,
        course_id: row.course_id,
        courseName: course?.name ?? "Course",
        tutor_id: row.tutor_id,
        tutorLabel: row.tutor_id ? labelById.get(row.tutor_id) ?? null : null,
        members: membersByCohort.get(row.id) ?? [],
      };
    });
  }

  return { enrollments, cohorts, staffMembers, errors };
}
