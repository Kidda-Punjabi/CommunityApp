import "server-only";

import {
  fetchCommunityPackageProduct,
  syncCommunityCourseAccess,
} from "@/lib/admin/community-package";
import { syncPackageCourseAccess } from "@/lib/admin/package-course-access";
import type { AdminPackageKind } from "@/lib/admin/packages/types";
import { isPersistedStudentPackageId } from "@/lib/admin/packages/roster-utils";
import type { PackageMembershipStatus } from "@/lib/admin/package-status";
import {
  ensureOnboardingChecklistForStudentPackage,
  markOnboardingPackageAssigned,
} from "@/lib/stripe/sync-student-packages-from-payment";
import type { SupabaseClient } from "@supabase/supabase-js";

const ROSTER_STATUSES: PackageMembershipStatus[] = [
  "interested",
  "waiting_for_payment",
  "confirmed",
];

export { isPersistedStudentPackageId };

export async function findStudentPackageForRun(
  supabase: SupabaseClient,
  kind: AdminPackageKind,
  runId: string,
  userId: string
): Promise<{ id: string; status: PackageMembershipStatus } | null> {
  if (kind === "community") {
    const communityProduct = await fetchCommunityPackageProduct(supabase);
    if (!communityProduct) return null;

    const { data } = await supabase
      .from("student_packages")
      .select("id, status")
      .eq("user_id", userId)
      .eq("package_id", communityProduct.id)
      .is("package_instance_id", null)
      .maybeSingle();

    if (!data) return null;
    return { id: data.id, status: data.status as PackageMembershipStatus };
  }

  if (kind === "cohort") {
    const { data: enrollment } = await supabase
      .from("course_enrollments")
      .select("id, student_package_id")
      .eq("cohort_id", runId)
      .eq("user_id", userId)
      .maybeSingle();

    if (enrollment?.student_package_id) {
      const { data } = await supabase
        .from("student_packages")
        .select("id, status")
        .eq("id", enrollment.student_package_id)
        .maybeSingle();
      if (data) return { id: data.id, status: data.status as PackageMembershipStatus };
    }

    const { data: cohort } = await supabase
      .from("cohorts")
      .select("course_id")
      .eq("id", runId)
      .maybeSingle();
    if (!cohort) return null;

    const { data: groupPkg } = await supabase
      .from("packages")
      .select("id")
      .eq("course_id", cohort.course_id)
      .eq("delivery_mode", "group")
      .maybeSingle();
    if (!groupPkg) return null;

    const { data } = await supabase
      .from("student_packages")
      .select("id, status")
      .eq("user_id", userId)
      .eq("package_id", groupPkg.id)
      .maybeSingle();

    if (!data) return null;
    return { id: data.id, status: data.status as PackageMembershipStatus };
  }

  const { data: byInstance } = await supabase
    .from("student_packages")
    .select("id, status")
    .eq("package_instance_id", runId)
    .eq("user_id", userId)
    .maybeSingle();

  if (byInstance) {
    return { id: byInstance.id, status: byInstance.status as PackageMembershipStatus };
  }

  const { data: instance } = await supabase
    .from("package_instances")
    .select("package_id")
    .eq("id", runId)
    .maybeSingle();
  if (!instance) return null;

  const { data: byPackage } = await supabase
    .from("student_packages")
    .select("id, status")
    .eq("user_id", userId)
    .eq("package_id", instance.package_id)
    .maybeSingle();

  if (!byPackage) return null;
  return { id: byPackage.id, status: byPackage.status as PackageMembershipStatus };
}

async function syncMembershipAccess(
  supabase: SupabaseClient,
  kind: AdminPackageKind,
  userId: string,
  courseId: string,
  status: PackageMembershipStatus
): Promise<{ error?: string }> {
  if (kind === "community") {
    return syncCommunityCourseAccess(supabase, userId, courseId, status);
  }
  return syncPackageCourseAccess(supabase, userId, courseId, status);
}

export async function setPackageRunRosterStatus(
  supabase: SupabaseClient,
  input: {
    kind: AdminPackageKind;
    runId: string;
    userId: string;
    status: PackageMembershipStatus;
    courseId: string;
    packageId: string | null;
  }
): Promise<{ studentPackageId?: string; error?: string }> {
  if (!ROSTER_STATUSES.includes(input.status)) {
    return { error: "Invalid roster status." };
  }

  const existing = await findStudentPackageForRun(
    supabase,
    input.kind,
    input.runId,
    input.userId
  );

  if (existing) {
    const updatePayload: { status: PackageMembershipStatus; package_instance_id?: string } = {
      status: input.status,
    };
    if (input.kind === "package_instance") {
      updatePayload.package_instance_id = input.runId;
    }

    const { error } = await supabase
      .from("student_packages")
      .update(updatePayload)
      .eq("id", existing.id);
    if (error) return { error: error.message };

    const sync = await syncMembershipAccess(
      supabase,
      input.kind,
      input.userId,
      input.courseId,
      input.status
    );
    if (sync.error) return { error: sync.error };

    return { studentPackageId: existing.id };
  }

  if (input.kind === "community") {
    const communityProduct = await fetchCommunityPackageProduct(supabase);
    if (!communityProduct) {
      return { error: "Community package product not found." };
    }

    const { data, error } = await supabase
      .from("student_packages")
      .upsert(
        {
          user_id: input.userId,
          package_id: communityProduct.id,
          course_id: communityProduct.courseId,
          status: input.status,
          purchased_at: new Date().toISOString(),
        },
        { onConflict: "user_id,package_id" }
      )
      .select("id")
      .single();

    if (error) return { error: error.message };

    const sync = await syncCommunityCourseAccess(
      supabase,
      input.userId,
      communityProduct.courseId,
      input.status
    );
    if (sync.error) return { error: sync.error };

    return { studentPackageId: data.id };
  }

  if (input.kind === "cohort") {
    const { data: cohort, error: cohortError } = await supabase
      .from("cohorts")
      .select("id, course_id, tutor_id")
      .eq("id", input.runId)
      .maybeSingle();

    if (cohortError) return { error: cohortError.message };
    if (!cohort) return { error: "Cohort not found." };

    const { data: groupPkg, error: pkgError } = await supabase
      .from("packages")
      .select("id, slug")
      .eq("course_id", cohort.course_id)
      .eq("delivery_mode", "group")
      .maybeSingle();

    if (pkgError) return { error: pkgError.message };
    if (!groupPkg) return { error: "Group package product not found for this course." };

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("course_enrollments")
      .upsert(
        {
          user_id: input.userId,
          course_id: cohort.course_id,
          tutor_id: cohort.tutor_id,
          delivery_mode: "group",
          cohort_id: cohort.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,course_id" }
      )
      .select("id")
      .single();

    if (enrollmentError) return { error: enrollmentError.message };

    const { data: studentPackage, error: spError } = await supabase
      .from("student_packages")
      .upsert(
        {
          user_id: input.userId,
          package_id: groupPkg.id,
          course_id: cohort.course_id,
          enrollment_id: enrollment.id,
          status: input.status,
          purchased_at: new Date().toISOString(),
        },
        { onConflict: "user_id,package_id" }
      )
      .select("id")
      .single();

    if (spError) return { error: spError.message };

    await ensureOnboardingChecklistForStudentPackage(
      supabase,
      studentPackage.id,
      groupPkg.slug,
      new Date().toISOString()
    );
    await markOnboardingPackageAssigned(supabase, studentPackage.id);

    const sync = await syncPackageCourseAccess(
      supabase,
      input.userId,
      cohort.course_id,
      input.status
    );
    if (sync.error) return { error: sync.error };

    return { studentPackageId: studentPackage.id };
  }

  if (!input.packageId) {
    return { error: "Package product not found for this run." };
  }

  const { data: instance, error: instanceError } = await supabase
    .from("package_instances")
    .select("id, package_id, course_id, packages(slug)")
    .eq("id", input.runId)
    .maybeSingle();

  if (instanceError) return { error: instanceError.message };
  if (!instance) return { error: "Package run not found." };

  const pkg = Array.isArray(instance.packages) ? instance.packages[0] : instance.packages;
  const packageSlug = pkg?.slug ?? "foundational";

  const { data: studentPackage, error: spError } = await supabase
    .from("student_packages")
    .upsert(
      {
        user_id: input.userId,
        package_id: instance.package_id,
        course_id: instance.course_id,
        package_instance_id: instance.id,
        status: input.status,
        purchased_at: new Date().toISOString(),
      },
      { onConflict: "user_id,package_id" }
    )
    .select("id")
    .single();

  if (spError) return { error: spError.message };

  await ensureOnboardingChecklistForStudentPackage(
    supabase,
    studentPackage.id,
    packageSlug,
    new Date().toISOString()
  );
  await markOnboardingPackageAssigned(supabase, studentPackage.id);

  const sync = await syncPackageCourseAccess(
    supabase,
    input.userId,
    instance.course_id,
    input.status
  );
  if (sync.error) return { error: sync.error };

  return { studentPackageId: studentPackage.id };
}

export async function withdrawPackageRunRosterMember(
  supabase: SupabaseClient,
  input: {
    kind: AdminPackageKind;
    runId: string;
    userId: string;
    studentPackageId?: string;
    courseId: string;
  }
): Promise<{ error?: string }> {
  let targetId = input.studentPackageId && isPersistedStudentPackageId(input.studentPackageId)
    ? input.studentPackageId
    : undefined;

  if (!targetId) {
    const existing = await findStudentPackageForRun(
      supabase,
      input.kind,
      input.runId,
      input.userId
    );
    if (!existing) {
      return { error: "No membership record found for this person on this package." };
    }
    targetId = existing.id;
  }

  const { data: row, error: loadError } = await supabase
    .from("student_packages")
    .select("id, user_id, course_id, status")
    .eq("id", targetId)
    .maybeSingle();

  if (loadError) return { error: loadError.message };
  if (!row) return { error: "Student package not found." };

  const { error } = await supabase
    .from("student_packages")
    .update({ status: "withdrawn" })
    .eq("id", row.id);
  if (error) return { error: error.message };

  const sync = await syncMembershipAccess(
    supabase,
    input.kind,
    row.user_id,
    row.course_id,
    "withdrawn"
  );
  if (sync.error) return { error: sync.error };

  return {};
}
