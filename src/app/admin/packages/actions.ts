"use server";

import { requireAdminFromActions, type ActionResult } from "@/app/admin/content/actions";
import {
  loadAdminPackageDetail,
  loadAdminPackagesList,
  loadOnboardingChecklist,
} from "@/lib/admin/load-admin-packages";
import type {
  AdminPackageDetail,
  AdminPackageKind,
  AdminPackageListRow,
  AdminSavedView,
  OnboardingChecklistRow,
  PackagesViewConfig,
} from "@/lib/admin/packages/types";
import { DEFAULT_PACKAGES_VIEW_CONFIG } from "@/lib/admin/packages/types";
import { getDisplayName } from "@/lib/profile/display-name";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import type { PackageInstanceStatus, PackageMembershipStatus } from "@/lib/admin/package-status";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const PACKAGES_PATH = "/admin/packages";

function revalidatePackages(id?: string) {
  revalidatePath(PACKAGES_PATH);
  if (id) revalidatePath(`${PACKAGES_PATH}/${id}`);
}

export async function fetchAdminPackagesList(): Promise<{
  rows: AdminPackageListRow[];
  error?: string;
}> {
  try {
    const supabase = await requireAdminFromActions();
    return loadAdminPackagesList(supabase);
  } catch (e) {
    return {
      rows: [],
      error: e instanceof Error ? e.message : "Failed to load packages.",
    };
  }
}

export async function fetchAdminPackageDetail(
  kind: AdminPackageKind,
  id: string
): Promise<{ detail: AdminPackageDetail | null; error?: string }> {
  try {
    const supabase = await requireAdminFromActions();
    return loadAdminPackageDetail(supabase, kind, id);
  } catch (e) {
    return {
      detail: null,
      error: e instanceof Error ? e.message : "Failed to load package.",
    };
  }
}

export async function resolvePackageKind(id: string): Promise<AdminPackageKind | null> {
  const supabase = await requireAdminFromActions();
  const { data: cohort } = await supabase.from("cohorts").select("id").eq("id", id).maybeSingle();
  if (cohort) return "cohort";
  const { data: instance } = await supabase
    .from("package_instances")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (instance) return "package_instance";
  return null;
}

export async function updatePackageInstanceStatus(
  kind: AdminPackageKind,
  id: string,
  status: PackageInstanceStatus
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const table = kind === "cohort" ? "cohorts" : "package_instances";
    const { error } = await supabase.from(table).update({ status }).eq("id", id);
    if (error) return { error: error.message };
    revalidatePackages(id);
    return { success: "Status updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update status." };
  }
}

export async function updatePackageRunFields(
  kind: AdminPackageKind,
  id: string,
  fields: {
    name?: string;
    tutorId?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    startDayOfWeek?: string | null;
    capacity?: number;
    active?: boolean;
  }
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const table = kind === "cohort" ? "cohorts" : "package_instances";
    const payload: Record<string, unknown> = {};
    if (fields.name !== undefined) payload.name = fields.name;
    if (fields.tutorId !== undefined) payload.tutor_id = fields.tutorId;
    if (fields.startDate !== undefined) payload.start_date = fields.startDate;
    if (fields.endDate !== undefined) payload.end_date = fields.endDate;
    if (fields.startDayOfWeek !== undefined) payload.start_day_of_week = fields.startDayOfWeek;
    if (fields.capacity !== undefined) payload.capacity = fields.capacity;
    if (fields.active !== undefined) payload.active = fields.active;

    const { error } = await supabase.from(table).update(payload).eq("id", id);
    if (error) return { error: error.message };
    revalidatePackages(id);
    return { success: "Package updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update package." };
  }
}

export type PackageFormOptions = {
  courses: Array<{ id: string; name: string; tier: string | null }>;
  packages: Array<{
    id: string;
    name: string;
    courseId: string;
    deliveryMode: string | null;
  }>;
  tutors: Array<{ id: string; name: string }>;
};

export async function fetchPackageFormOptions(): Promise<PackageFormOptions> {
  try {
    const supabase = await requireAdminFromActions();
    const service = createServiceRoleClient();

    const [{ data: courses }, { data: packages }, { data: roleRows }] = await Promise.all([
      supabase.from("courses").select("id, name, required_tier").order("name"),
      supabase.from("packages").select("id, name, course_id, delivery_mode").eq("active", true).order("display_order"),
      service
        .from("profile_roles")
        .select("user_id")
        .in("role", ["tutor", "community_lead", "master_admin"]),
    ]);

    const tutorIds = [...new Set((roleRows ?? []).map((r) => r.user_id))];
    const { data: profiles } =
      tutorIds.length > 0
        ? await service
            .from("profiles")
            .select("id, full_name, preferred_name")
            .in("id", tutorIds)
        : { data: [] };

    return {
      courses: (courses ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        tier: c.required_tier,
      })),
      packages: (packages ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        courseId: p.course_id,
        deliveryMode: p.delivery_mode,
      })),
      tutors: (profiles ?? [])
        .map((p) => ({
          id: p.id,
          name: getDisplayName(p) ?? p.id.slice(0, 8),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  } catch {
    return { courses: [], packages: [], tutors: [] };
  }
}

export async function createPackageRun(input: {
  kind: AdminPackageKind;
  name: string;
  courseId?: string;
  packageId?: string;
  tutorId?: string | null;
  status?: PackageInstanceStatus;
  capacity?: number;
  startDayOfWeek?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}): Promise<ActionResult & { id?: string }> {
  try {
    const supabase = await requireAdminFromActions();
    const name = input.name.trim();
    if (!name) return { error: "Name is required." };

    if (input.kind === "cohort") {
      const courseId = input.courseId?.trim();
      if (!courseId) return { error: "Course is required for a group cohort." };

      const { data: course } = await supabase
        .from("courses")
        .select("required_tier")
        .eq("id", courseId)
        .maybeSingle();

      if (course?.required_tier !== "beginners") {
        return { error: "Group cohorts are only supported for the Beginners course." };
      }

      const { data, error } = await supabase
        .from("cohorts")
        .insert({
          course_id: courseId,
          name,
          tutor_id: input.tutorId ?? null,
          status: input.status ?? "pre_scheduling",
          capacity: input.capacity ?? 7,
          start_day_of_week: input.startDayOfWeek ?? null,
          start_date: input.startDate ?? null,
          end_date: input.endDate ?? null,
        })
        .select("id")
        .single();

      if (error) return { error: error.message };
      revalidatePackages(data.id);
      return { success: `Cohort “${name}” created.`, id: data.id };
    }

    const packageId = input.packageId?.trim();
    if (!packageId) return { error: "Package product is required for a 1-1 run." };

    const { data: pkg } = await supabase
      .from("packages")
      .select("course_id, delivery_mode")
      .eq("id", packageId)
      .maybeSingle();

    if (!pkg) return { error: "Package product not found." };
    if (pkg.delivery_mode === "group") {
      return { error: "Group products use cohorts — pick a 1-1 or Foundational package." };
    }

    const { data, error } = await supabase
      .from("package_instances")
      .insert({
        package_id: packageId,
        course_id: pkg.course_id,
        name,
        tutor_id: input.tutorId ?? null,
        status: input.status ?? "pre_scheduling",
        capacity: input.capacity ?? 1,
        start_day_of_week: input.startDayOfWeek ?? null,
        start_date: input.startDate ?? null,
        end_date: input.endDate ?? null,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };
    revalidatePackages(data.id);
    return { success: `Package “${name}” created.`, id: data.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create package." };
  }
}

export async function updateStudentPackageMembershipStatus(
  studentPackageId: string,
  status: PackageMembershipStatus
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const { error } = await supabase
      .from("student_packages")
      .update({ status })
      .eq("id", studentPackageId);
    if (error) return { error: error.message };
    revalidatePackages();
    return { success: "Student status updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update student status." };
  }
}

export async function fetchOnboardingChecklist(studentPackageId: string): Promise<{
  checklist: OnboardingChecklistRow | null;
  error?: string;
}> {
  try {
    const supabase = await requireAdminFromActions();
    return loadOnboardingChecklist(supabase, studentPackageId);
  } catch (e) {
    return {
      checklist: null,
      error: e instanceof Error ? e.message : "Failed to load checklist.",
    };
  }
}

export async function upsertOnboardingChecklist(
  studentPackageId: string,
  checklistType: "group" | "one_to_one",
  fields: Partial<OnboardingChecklistRow> & { id?: string }
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const payload = {
      student_package_id: studentPackageId,
      checklist_type: checklistType,
      time_assigned: fields.timeAssigned ?? false,
      welcome_email: fields.welcomeEmail ?? false,
      calendar_invite: fields.calendarInvite ?? false,
      tutor_notified: fields.tutorNotified ?? false,
      package_created: fields.packageCreated ?? false,
      whatsapp_chat_made: fields.whatsappChatMade ?? false,
      schedule_whatsapp_chat: fields.scheduleWhatsappChat ?? false,
      onboarding_completed: fields.onboardingCompleted ?? false,
      payment_date: fields.paymentDate,
      notes: fields.notes ?? null,
    };

    if (fields.id) {
      const { error } = await supabase
        .from("onboarding_checklists")
        .update(payload)
        .eq("id", fields.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("onboarding_checklists").insert(payload);
      if (error) return { error: error.message };
    }

    revalidatePackages();
    return { success: "Checklist saved." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save checklist." };
  }
}

function parsePackagesViewConfig(raw: unknown): PackagesViewConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_PACKAGES_VIEW_CONFIG;
  const config = raw as Partial<PackagesViewConfig>;
  return {
    search: typeof config.search === "string" ? config.search : "",
    filters: {
      status: Array.isArray(config.filters?.status) ? config.filters.status : [],
      tutorIds: Array.isArray(config.filters?.tutorIds) ? config.filters.tutorIds : [],
      courseIds: Array.isArray(config.filters?.courseIds) ? config.filters.courseIds : [],
      deliveryModes: Array.isArray(config.filters?.deliveryModes)
        ? config.filters.deliveryModes
        : [],
    },
    groupBy:
      config.groupBy === "status" || config.groupBy === "tutor" ? config.groupBy : "none",
    sort: {
      field: config.sort?.field === "name" ? "name" : "startDate",
      direction: config.sort?.direction === "asc" ? "asc" : "desc",
    },
  };
}

export async function fetchPackagesSavedViews(): Promise<{
  views: AdminSavedView[];
  error?: string;
}> {
  try {
    const supabase = await requireAdminFromActions();
    const { data, error } = await supabase
      .from("admin_saved_views")
      .select("id, name, view_type, config, created_by, created_at")
      .eq("view_type", "packages")
      .order("created_at", { ascending: false });

    if (error) {
      if (error.message.includes("admin_saved_views")) {
        return { views: [], error: "Run supabase/admin-saved-views.sql to enable saved views." };
      }
      return { views: [], error: error.message };
    }

    return {
      views: (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        viewType: row.view_type,
        config: parsePackagesViewConfig(row.config),
        createdBy: row.created_by,
        createdAt: row.created_at,
      })),
    };
  } catch (e) {
    return {
      views: [],
      error: e instanceof Error ? e.message : "Failed to load saved views.",
    };
  }
}

export async function savePackagesView(name: string, config: PackagesViewConfig): Promise<ActionResult> {
  try {
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const supabase = await requireAdminFromActions();
    const { error } = await supabase.from("admin_saved_views").insert({
      name: name.trim(),
      view_type: "packages",
      config,
      created_by: user.id,
    });

    if (error) return { error: error.message };
    return { success: "View saved for everyone." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save view." };
  }
}

export async function deletePackagesSavedView(viewId: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const { error } = await supabase.from("admin_saved_views").delete().eq("id", viewId);
    if (error) return { error: error.message };
    return { success: "View deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete view." };
  }
}
