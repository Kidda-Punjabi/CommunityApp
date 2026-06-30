"use server";

import { requireAdminFromActions, type ActionResult } from "@/app/admin/content/actions";
import { loadAdminOnboardingQueue } from "@/lib/admin/load-admin-onboarding";
import { ONBOARDING_CHECKLIST_COLUMNS } from "@/lib/admin/onboarding/checklist-fields";
import type {
  AdminOnboardingCompletedRow,
  AdminOnboardingRow,
  AdminOnboardingSummary,
} from "@/lib/admin/onboarding/types";
import type { AdminPackageKind } from "@/lib/admin/packages/types";
import type { OnboardingChecklistRow } from "@/lib/admin/packages/types";
import { ensureOnboardingChecklistForStudentPackage, markOnboardingPackageAssigned } from "@/lib/stripe/sync-student-packages-from-payment";
import { revalidatePath } from "next/cache";

const ONBOARDING_PATH = "/admin/onboarding";
const PACKAGES_PATH = "/admin/packages";

function revalidateOnboarding(runId?: string) {
  revalidatePath(ONBOARDING_PATH);
  revalidatePath(PACKAGES_PATH);
  if (runId) revalidatePath(`${PACKAGES_PATH}/${runId}`);
}

export async function fetchAdminOnboardingQueue(): Promise<{
  rows: AdminOnboardingRow[];
  completedRows: AdminOnboardingCompletedRow[];
  summary: AdminOnboardingSummary;
  error?: string;
}> {
  try {
    const supabase = await requireAdminFromActions();
    return loadAdminOnboardingQueue(supabase);
  } catch (e) {
    return {
      rows: [],
      completedRows: [],
      summary: {
        onboardingCount: 0,
        offboardingCount: 0,
        overdueCount: 0,
        completedCount: 0,
      },
      error: e instanceof Error ? e.message : "Failed to load onboarding queue.",
    };
  }
}

export type OnboardingPackageRunOption = {
  id: string;
  kind: Exclude<AdminPackageKind, "community">;
  name: string;
};

export async function fetchPackageRunsForOnboarding(
  courseId: string,
  deliveryMode: "group" | "one_to_one"
): Promise<{ runs: OnboardingPackageRunOption[]; error?: string }> {
  try {
    const supabase = await requireAdminFromActions();

    if (deliveryMode === "group") {
      const { data, error } = await supabase
        .from("cohorts")
        .select("id, name")
        .eq("course_id", courseId)
        .eq("active", true)
        .order("name");

      if (error) return { runs: [], error: error.message };
      return {
        runs: (data ?? []).map((row) => ({
          id: row.id,
          kind: "cohort",
          name: row.name,
        })),
      };
    }

    const { data, error } = await supabase
      .from("package_instances")
      .select("id, name")
      .eq("course_id", courseId)
      .eq("active", true)
      .order("name");

    if (error) return { runs: [], error: error.message };
    return {
      runs: (data ?? []).map((row) => ({
        id: row.id,
        kind: "package_instance",
        name: row.name,
      })),
    };
  } catch (e) {
    return {
      runs: [],
      error: e instanceof Error ? e.message : "Failed to load package runs.",
    };
  }
}

const BOOLEAN_CHECKLIST_FIELDS = new Set<keyof OnboardingChecklistRow>([
  "timeAssigned",
  "welcomeEmail",
  "calendarInvite",
  "tutorNotified",
  "packageCreated",
  "whatsappChatMade",
  "scheduleWhatsappChat",
  "onboardingCompleted",
]);

export async function toggleOnboardingChecklistField(
  studentPackageId: string,
  checklistType: "group" | "one_to_one",
  field: keyof OnboardingChecklistRow,
  value: boolean
): Promise<ActionResult> {
  if (!BOOLEAN_CHECKLIST_FIELDS.has(field)) {
    return { error: "Invalid checklist field." };
  }

  try {
    const supabase = await requireAdminFromActions();
    const dbFieldMap: Record<string, string> = {
      timeAssigned: "time_assigned",
      welcomeEmail: "welcome_email",
      calendarInvite: "calendar_invite",
      tutorNotified: "tutor_notified",
      packageCreated: "package_created",
      whatsappChatMade: "whatsapp_chat_made",
      scheduleWhatsappChat: "schedule_whatsapp_chat",
      onboardingCompleted: "onboarding_completed",
    };

    const dbField = dbFieldMap[field];
    if (!dbField) return { error: "Invalid checklist field." };

    const { data: existing } = await supabase
      .from("onboarding_checklists")
      .select("id")
      .eq("student_package_id", studentPackageId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("onboarding_checklists")
        .update({ [dbField]: value })
        .eq("id", existing.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("onboarding_checklists").insert({
        student_package_id: studentPackageId,
        checklist_type: checklistType,
        [dbField]: value,
      });
      if (error) return { error: error.message };
    }

    revalidateOnboarding();
    return { success: "Saved." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update checklist." };
  }
}

export async function assignOnboardingStudentToRun(
  studentPackageId: string,
  kind: Exclude<AdminPackageKind, "community">,
  runId: string
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    if (!runId) return { error: "Select a package run." };

    const { data: studentPackage, error: loadError } = await supabase
      .from("student_packages")
      .select("id, user_id, course_id, package_id, packages(slug, delivery_mode)")
      .eq("id", studentPackageId)
      .maybeSingle();

    if (loadError) return { error: loadError.message };
    if (!studentPackage) return { error: "Student package not found." };

    const pkg = Array.isArray(studentPackage.packages)
      ? studentPackage.packages[0]
      : studentPackage.packages;

    if (kind === "cohort") {
      const { data: cohort, error: cohortError } = await supabase
        .from("cohorts")
        .select("id, course_id, tutor_id")
        .eq("id", runId)
        .maybeSingle();

      if (cohortError) return { error: cohortError.message };
      if (!cohort) return { error: "Cohort not found." };
      if (cohort.course_id !== studentPackage.course_id) {
        return { error: "This cohort is for a different course." };
      }

      const { data: enrollment, error: enrollmentError } = await supabase
        .from("course_enrollments")
        .upsert(
          {
            user_id: studentPackage.user_id,
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

      const { error: updateError } = await supabase
        .from("student_packages")
        .update({
          enrollment_id: enrollment.id,
          package_instance_id: null,
        })
        .eq("id", studentPackageId);

      if (updateError) return { error: updateError.message };
    } else {
      const { data: instance, error: instanceError } = await supabase
        .from("package_instances")
        .select("id, course_id, package_id")
        .eq("id", runId)
        .maybeSingle();

      if (instanceError) return { error: instanceError.message };
      if (!instance) return { error: "Package run not found." };
      if (instance.course_id !== studentPackage.course_id) {
        return { error: "This package run is for a different course." };
      }

      const { error: updateError } = await supabase
        .from("student_packages")
        .update({
          package_instance_id: instance.id,
          enrollment_id: null,
        })
        .eq("id", studentPackageId);

      if (updateError) return { error: updateError.message };
    }

    if (pkg?.slug) {
      await ensureOnboardingChecklistForStudentPackage(
        supabase,
        studentPackageId,
        pkg.slug,
        new Date().toISOString()
      );
    }
    await markOnboardingPackageAssigned(supabase, studentPackageId);

    revalidateOnboarding(runId);
    return { success: "Package assigned." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to assign package." };
  }
}
