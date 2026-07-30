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
import { parsePackageTableColumnIds } from "@/lib/admin/packages/table-columns";
import {
  fetchCommunityPackageProduct,
  syncCommunityCourseAccess,
} from "@/lib/admin/community-package";
import {
  setPackageRunRosterStatus,
  withdrawPackageRunRosterMember as withdrawRosterMember,
} from "@/lib/admin/packages/roster-membership";
import {
  searchPackageRosterCandidates,
  type PackageRosterCandidateOption,
} from "@/lib/admin/packages/search-package-candidates";
import { syncPackageCourseAccess } from "@/lib/admin/package-course-access";
import { ensureOnboardingChecklistForStudentPackage, markOnboardingPackageAssigned } from "@/lib/stripe/sync-student-packages-from-payment";
import { getDisplayName } from "@/lib/profile/display-name";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import type { PackageInstanceStatus, PackageMembershipStatus } from "@/lib/admin/package-status";
import { inboxCohortLinkColumnAvailable } from "@/lib/notion/notion-cohort-link";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const PACKAGES_PATH = "/admin/packages";
const ONBOARDING_PATH = "/admin/onboarding";

function revalidatePackages(id?: string) {
  revalidatePath(PACKAGES_PATH);
  revalidatePath(ONBOARDING_PATH);
  if (id) revalidatePath(`${PACKAGES_PATH}/${id}`);
}

export async function fetchAdminPackagesList(): Promise<{
  rows: AdminPackageListRow[];
  error?: string;
}> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
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

export async function updateCohortAutoUnlockOnLog(
  cohortId: string,
  enabled: boolean
): Promise<ActionResult> {
  try {
    await requireAdminFromActions();
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const supabase = createServiceRoleClient();
    const { setCohortAutoUnlockOnLogEnabled } = await import(
      "@/lib/lessons/cohort-lesson-unlock"
    );
    const result = await setCohortAutoUnlockOnLogEnabled(supabase, {
      cohortId,
      enabled,
      updatedBy: user.id,
    });
    if (!result.ok) return { error: result.reason };

    revalidatePackages(cohortId);
    revalidatePath("/admin/lesson-log");
    return {
      success: enabled
        ? "Auto-unlock on log is on — logging sessions will unlock lessons for students."
        : "Auto-unlock on log is off — use Unlock in the lesson log to release content.",
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to update auto-unlock setting.",
    };
  }
}

export async function resolvePackageKind(id: string): Promise<AdminPackageKind | null> {
  const supabase = await requireAdminFromActions();
  const communityProduct = await fetchCommunityPackageProduct(supabase);
  if (communityProduct?.id === id) return "community";
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
    if (kind === "community") {
      return { error: "Community is always active — manage members on the roster instead." };
    }
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
    if (kind === "community") {
      const payload: Record<string, unknown> = {};
      if (fields.name !== undefined) payload.name = fields.name;
      if (fields.active !== undefined) payload.active = fields.active;
      if (Object.keys(payload).length === 0) {
        return { success: "Nothing to update." };
      }
      const { error } = await supabase.from("packages").update(payload).eq("id", id);
      if (error) return { error: error.message };
      revalidatePackages(id);
      return { success: "Community package updated." };
    }

    const table = kind === "cohort" ? "cohorts" : "package_instances";
    const payload: Record<string, unknown> = {};
    if (fields.name !== undefined) payload.name = fields.name;
    if (fields.tutorId !== undefined) {
      payload.tutor_id = fields.tutorId;
      payload.tutor_id_source = "manual";
    }
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

export async function assignPackageTutorInline(
  kind: AdminPackageKind,
  id: string,
  tutorId: string | null
): Promise<ActionResult> {
  return updatePackageRunFields(kind, id, { tutorId });
}

export async function resetPackageTutorToNotion(
  kind: AdminPackageKind,
  id: string
): Promise<ActionResult & { tutorId?: string | null; tutorName?: string | null }> {
  try {
    const supabase = await requireAdminFromActions();
    if (kind === "community") {
      return { error: "Community package has no tutor assignment." };
    }

    if (kind === "cohort") {
      const { refreshCohortFromNotionPage, loadNotionTutorMap, parseNotionPackagePage, tutorIdFromNotionPackagePage } =
        await import("@/lib/notion/package-sync");
      const { notionJson } = await import("@/lib/notion/client");

      const { data: cohort, error: loadError } = await supabase
        .from("cohorts")
        .select("id, notion_page_id")
        .eq("id", id)
        .maybeSingle();
      if (loadError) return { error: loadError.message };
      if (!cohort?.notion_page_id) {
        return { error: "Cohort is not linked to a Notion page." };
      }

      const pageRaw = await notionJson<{
        id: string;
        last_edited_time: string;
        properties: Record<string, unknown>;
      }>(`/pages/${cohort.notion_page_id}`);
      const page = parseNotionPackagePage(pageRaw);
      const { byNotionUserId } = await loadNotionTutorMap(supabase);
      const mapped = tutorIdFromNotionPackagePage(page, byNotionUserId);
      const tutorId = mapped === undefined ? null : mapped;

      const { error } = await supabase
        .from("cohorts")
        .update({ tutor_id: tutorId, tutor_id_source: "notion" })
        .eq("id", id);
      if (error) return { error: error.message };

      // Refresh other Notion fields without re-locking tutor (source is notion now).
      await refreshCohortFromNotionPage(supabase, id);

      let tutorName: string | null = null;
      if (tutorId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, preferred_name")
          .eq("id", tutorId)
          .maybeSingle();
        tutorName = profile ? getDisplayName(profile) : null;
      }

      revalidatePackages(id);
      return {
        success: tutorId
          ? "Tutor reset from Notion."
          : "Reset to Notion — no mapped tutor on the page (check Tutor map).",
        tutorId,
        tutorName,
      };
    }

    const { data: instance, error: loadError } = await supabase
      .from("package_instances")
      .select("id, notion_page_id")
      .eq("id", id)
      .maybeSingle();
    if (loadError) return { error: loadError.message };
    if (!instance?.notion_page_id) {
      return { error: "Package instance is not linked to a Notion page." };
    }

    const { loadNotionTutorMap, parseNotionPackagePage, tutorIdFromNotionPackagePage } =
      await import("@/lib/notion/package-sync");
    const { notionJson } = await import("@/lib/notion/client");

    const pageRaw = await notionJson<{
      id: string;
      last_edited_time: string;
      properties: Record<string, unknown>;
    }>(`/pages/${instance.notion_page_id}`);
    const page = parseNotionPackagePage(pageRaw);
    const { byNotionUserId } = await loadNotionTutorMap(supabase);
    const mapped = tutorIdFromNotionPackagePage(page, byNotionUserId);
    const tutorId = mapped === undefined ? null : mapped;

    const { error } = await supabase
      .from("package_instances")
      .update({ tutor_id: tutorId, tutor_id_source: "notion" })
      .eq("id", id);
    if (error) return { error: error.message };

    let tutorName: string | null = null;
    if (tutorId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, preferred_name")
        .eq("id", tutorId)
        .maybeSingle();
      tutorName = profile ? getDisplayName(profile) : null;
    }

    revalidatePackages(id);
    return {
      success: tutorId
        ? "Tutor reset from Notion."
        : "Reset to Notion — no mapped tutor on the page (check Tutor map).",
      tutorId,
      tutorName,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to reset tutor from Notion." };
  }
}

export async function searchPackageInstanceCalendarMatches(packageInstanceId: string): Promise<{
  candidates: Array<{
    googleEventId: string;
    recurringEventId: string;
    title: string;
    nextStartsAt: string;
    nextEndsAt: string;
    weekday: string;
    timeLabel: string;
    score: number;
    reasons: string[];
  }>;
  state?: "ok" | "no_tutor" | "no_connection" | "no_student";
  error?: string;
}> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const { searchPackageInstanceCalendarCandidates } = await import(
      "@/lib/admin/packages/package-instance-calendar-link"
    );
    const result = await searchPackageInstanceCalendarCandidates(supabase, packageInstanceId);
    if (!result.ok) return { candidates: [], error: result.error };
    return { candidates: result.candidates, state: result.state };
  } catch (e) {
    return {
      candidates: [],
      error: e instanceof Error ? e.message : "Calendar search failed.",
    };
  }
}

export async function linkPackageInstanceCalendarMatch(input: {
  packageInstanceId: string;
  googleEventId: string;
  recurringEventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
}): Promise<ActionResult> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const { linkPackageInstanceRecurringCalendarEvent } = await import(
      "@/lib/admin/packages/package-instance-calendar-link"
    );
    const result = await linkPackageInstanceRecurringCalendarEvent(supabase, {
      packageInstanceId: input.packageInstanceId,
      googleEventId: input.googleEventId,
      recurringEventId: input.recurringEventId,
      title: input.title,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });
    if (!result.ok) return { error: result.error ?? "Failed to link calendar event." };
    revalidatePackages(input.packageInstanceId);
    const n = result.linkedCount ?? 1;
    return {
      success:
        n > 1
          ? `Calendar series linked (${n} sessions).`
          : "Calendar event linked.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to link calendar event." };
  }
}

export async function unlinkPackageInstanceCalendarMatch(
  packageInstanceId: string
): Promise<ActionResult & { unlinkedCount?: number }> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const { unlinkPackageInstanceRecurringCalendarEvent } = await import(
      "@/lib/admin/packages/package-instance-calendar-link"
    );
    const result = await unlinkPackageInstanceRecurringCalendarEvent(supabase, {
      packageInstanceId,
    });
    if (!result.ok) return { error: result.error ?? "Failed to unlink calendar event." };
    revalidatePackages(packageInstanceId);
    return {
      success:
        (result.unlinkedCount ?? 0) > 0
          ? "Calendar event unlinked. Google Calendar was not changed."
          : "Calendar event unlinked. Google Calendar was not changed.",
      unlinkedCount: result.unlinkedCount,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to unlink calendar event." };
  }
}

export async function relinkPackageInstanceCalendarMatch(input: {
  packageInstanceId: string;
  googleEventId: string;
  recurringEventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
}): Promise<ActionResult> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const { relinkPackageInstanceRecurringCalendarEvent } = await import(
      "@/lib/admin/packages/package-instance-calendar-link"
    );
    const result = await relinkPackageInstanceRecurringCalendarEvent(supabase, {
      packageInstanceId: input.packageInstanceId,
      googleEventId: input.googleEventId,
      recurringEventId: input.recurringEventId,
      title: input.title,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });
    if (!result.ok) return { error: result.error ?? "Failed to re-link calendar event." };
    revalidatePackages(input.packageInstanceId);
    const linked = result.linkedCount ?? 1;
    const unlinked = result.unlinkedCount ?? 0;
    return {
      success:
        linked > 1
          ? `Re-linked calendar series (${unlinked} unlinked → ${linked} linked). Google Calendar was not changed.`
          : `Calendar event re-linked (${unlinked} session${unlinked === 1 ? "" : "s"} cleared first). Google Calendar was not changed.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to re-link calendar event." };
  }
}

export async function searchCohortCalendarMatches(cohortId: string): Promise<{
  candidates: Array<{
    googleEventId: string;
    recurringEventId: string;
    title: string;
    nextStartsAt: string;
    nextEndsAt: string;
    weekday: string;
    timeLabel: string;
    score: number;
    reasons: string[];
  }>;
  state?: "ok" | "no_tutor" | "no_connection";
  error?: string;
}> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const {
      searchCohortCalendarCandidates,
    } = await import("@/lib/admin/packages/cohort-calendar-link");
    const result = await searchCohortCalendarCandidates(supabase, cohortId);
    if (!result.ok) return { candidates: [], error: result.error };
    return { candidates: result.candidates, state: result.state };
  } catch (e) {
    return {
      candidates: [],
      error: e instanceof Error ? e.message : "Calendar search failed.",
    };
  }
}

export async function linkCohortCalendarMatch(input: {
  cohortId: string;
  googleEventId: string;
  recurringEventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
}): Promise<ActionResult> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const { linkCohortRecurringCalendarEvent } = await import(
      "@/lib/admin/packages/cohort-calendar-link"
    );
    const result = await linkCohortRecurringCalendarEvent(supabase, {
      cohortId: input.cohortId,
      googleEventId: input.googleEventId,
      recurringEventId: input.recurringEventId,
      title: input.title,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });
    if (!result.ok) return { error: result.error ?? "Failed to link calendar event." };
    revalidatePackages(input.cohortId);
    const n = result.linkedCount ?? 1;
    return {
      success:
        n > 1
          ? `Calendar series linked (${n} sessions).`
          : "Calendar event linked.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to link calendar event." };
  }
}

export async function unlinkCohortCalendarMatch(
  cohortId: string
): Promise<ActionResult & { unlinkedCount?: number }> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const { unlinkCohortRecurringCalendarEvent } = await import(
      "@/lib/admin/packages/cohort-calendar-link"
    );
    const result = await unlinkCohortRecurringCalendarEvent(supabase, { cohortId });
    if (!result.ok) return { error: result.error ?? "Failed to unlink calendar event." };
    revalidatePackages(cohortId);
    const n = result.unlinkedCount ?? 0;
    return {
      success:
        n > 1
          ? `Calendar series unlinked (${n} sessions). Google Calendar was not changed.`
          : "Calendar event unlinked. Google Calendar was not changed.",
      unlinkedCount: n,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to unlink calendar event." };
  }
}

export async function relinkCohortCalendarMatch(input: {
  cohortId: string;
  googleEventId: string;
  recurringEventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
}): Promise<ActionResult> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const { relinkCohortRecurringCalendarEvent } = await import(
      "@/lib/admin/packages/cohort-calendar-link"
    );
    const result = await relinkCohortRecurringCalendarEvent(supabase, {
      cohortId: input.cohortId,
      googleEventId: input.googleEventId,
      recurringEventId: input.recurringEventId,
      title: input.title,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });
    if (!result.ok) return { error: result.error ?? "Failed to re-link calendar event." };
    revalidatePackages(input.cohortId);
    const linked = result.linkedCount ?? 1;
    const unlinked = result.unlinkedCount ?? 0;
    return {
      success:
        linked > 1
          ? `Re-linked calendar series (${unlinked} unlinked → ${linked} linked). Google Calendar was not changed.`
          : `Calendar event re-linked (${unlinked} session${unlinked === 1 ? "" : "s"} cleared first). Google Calendar was not changed.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to re-link calendar event." };
  }
}

async function unlinkNotionInboxForDeletedPackageRun(
  supabase: SupabaseClient,
  kind: "cohort" | "package_instance",
  id: string
): Promise<void> {
  if (kind === "package_instance") {
    await supabase
      .from("notion_sync_inbox")
      .update({
        resolved: false,
        resolved_package_instance_id: null,
      })
      .eq("resolved_package_instance_id", id);
    return;
  }

  const hasResolvedCohortColumn = await inboxCohortLinkColumnAvailable(supabase);
  if (hasResolvedCohortColumn) {
    await supabase
      .from("notion_sync_inbox")
      .update({
        resolved: false,
        resolved_cohort_id: null,
        resolved_package_instance_id: null,
      })
      .eq("resolved_cohort_id", id);
  }

  const { data: inboxRows } = await supabase
    .from("notion_sync_inbox")
    .select("id, raw_properties")
    .eq("resolved", true);

  for (const row of inboxRows ?? []) {
    const raw = (row.raw_properties as Record<string, unknown> | null) ?? {};
    if (raw._resolved_cohort_id !== id) continue;

    await supabase
      .from("notion_sync_inbox")
      .update({
        resolved: false,
        resolved_package_instance_id: null,
        ...(hasResolvedCohortColumn ? { resolved_cohort_id: null } : {}),
        raw_properties: { ...raw, _resolved_cohort_id: null },
      })
      .eq("id", row.id);
  }
}

export async function deletePackageRun(
  kind: AdminPackageKind,
  id: string
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    if (kind === "community") {
      return { error: "The Kidda Community package cannot be deleted." };
    }

    const table = kind === "cohort" ? "cohorts" : "package_instances";
    await unlinkNotionInboxForDeletedPackageRun(supabase, kind, id);

    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return { error: error.message };

    revalidatePackages();
    return { success: "Package deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete package." };
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
          tutor_id_source: input.tutorId ? "manual" : "notion",
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
        tutor_id_source: input.tutorId ? "manual" : "notion",
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

export async function setPackageRunRosterMember(input: {
  kind: AdminPackageKind;
  runId: string;
  userId: string;
  status: PackageMembershipStatus;
  courseId: string;
  packageId: string | null;
}): Promise<ActionResult & { studentPackageId?: string }> {
  try {
    const supabase = await requireAdminFromActions();
    const result = await setPackageRunRosterStatus(supabase, input);
    if (result.error) return { error: result.error };
    revalidatePackages(input.runId);
    return { success: "Roster updated.", studentPackageId: result.studentPackageId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update roster." };
  }
}

export async function withdrawPackageRunRosterMember(input: {
  kind: AdminPackageKind;
  runId: string;
  userId: string;
  studentPackageId?: string;
  courseId: string;
}): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const result = await withdrawRosterMember(supabase, input);
    if (result.error) return { error: result.error };
    revalidatePackages(input.runId);
    return { success: "Member removed from roster." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to remove member." };
  }
}

export async function searchPackageRosterCandidatesAction(
  query: string
): Promise<{ results?: PackageRosterCandidateOption[]; error?: string }> {
  try {
    const supabase = await requireAdminFromActions();
    return searchPackageRosterCandidates(supabase, query);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Search failed." };
  }
}

export async function updateStudentPackageMembershipStatus(
  studentPackageId: string,
  status: PackageMembershipStatus
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const { data: row, error: loadError } = await supabase
      .from("student_packages")
      .select("id, user_id, course_id, package_id, packages(slug)")
      .eq("id", studentPackageId)
      .maybeSingle();

    if (loadError) return { error: loadError.message };
    if (!row) return { error: "Student package not found." };

    const { error } = await supabase
      .from("student_packages")
      .update({ status })
      .eq("id", studentPackageId);
    if (error) return { error: error.message };

    const pkg = Array.isArray(row.packages) ? row.packages[0] : row.packages;
    const sync = await syncPackageCourseAccess(
      supabase,
      row.user_id,
      row.course_id,
      status
    );
    if (sync.error) return { error: sync.error };

    revalidatePackages();
    return { success: "Student status updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update student status." };
  }
}

export async function addPackageRunMember(
  kind: AdminPackageKind,
  runId: string,
  userId: string,
  status: PackageMembershipStatus = "interested"
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    if (!userId) return { error: "Member is required." };
    if (status !== "interested" && status !== "confirmed" && status !== "waiting_for_payment") {
      return { error: "New members can only be added as Interested, Waiting for payment, or Confirmed." };
    }

    if (kind === "community") {
      const communityProduct = await fetchCommunityPackageProduct(supabase);
      if (!communityProduct) {
        return { error: "Community package product not found. Run supabase/student-packages.sql." };
      }

      const { error } = await supabase.from("student_packages").upsert(
        {
          user_id: userId,
          package_id: communityProduct.id,
          course_id: communityProduct.courseId,
          status,
          purchased_at: new Date().toISOString(),
        },
        { onConflict: "user_id,package_id" }
      );

      if (error) return { error: error.message };

      const sync = await syncCommunityCourseAccess(
        supabase,
        userId,
        communityProduct.courseId,
        status
      );
      if (sync.error) return { error: sync.error };

      revalidatePackages(communityProduct.id);
      return { success: "Member added to community." };
    }

    if (kind === "cohort") {
      const { data: cohort, error: cohortError } = await supabase
        .from("cohorts")
        .select("id, course_id, tutor_id")
        .eq("id", runId)
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
            user_id: userId,
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
            user_id: userId,
            package_id: groupPkg.id,
            course_id: cohort.course_id,
            enrollment_id: enrollment.id,
            status,
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

      revalidatePackages(runId);
      return { success: `Member added as ${status === "confirmed" ? "confirmed" : "interested"}.` };
    }

    const { data: instance, error: instanceError } = await supabase
      .from("package_instances")
      .select("id, package_id, course_id, packages(slug)")
      .eq("id", runId)
      .maybeSingle();

    if (instanceError) return { error: instanceError.message };
    if (!instance) return { error: "Package run not found." };

    const pkg = Array.isArray(instance.packages) ? instance.packages[0] : instance.packages;
    const packageSlug = pkg?.slug ?? "foundational";

    const { data: studentPackage, error: spError } = await supabase
      .from("student_packages")
      .upsert(
        {
          user_id: userId,
          package_id: instance.package_id,
          course_id: instance.course_id,
          package_instance_id: instance.id,
          status,
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

    revalidatePackages(runId);
    return { success: `Member added as ${status === "confirmed" ? "confirmed" : "interested"}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add member." };
  }
}

export async function addCommunityPackageMember(
  userId: string,
  status: PackageMembershipStatus = "confirmed"
): Promise<ActionResult> {
  return addPackageRunMember("community", "", userId, status);
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
    revalidatePath(ONBOARDING_PATH);
    return { success: "Checklist saved." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save checklist." };
  }
}

function parsePackagesViewConfig(raw: unknown): PackagesViewConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_PACKAGES_VIEW_CONFIG;
  const config = raw as Partial<PackagesViewConfig>;
  const hidden = parsePackageTableColumnIds(
    (config as PackagesViewConfig).columns?.hidden
  ).filter((id) => (id as string) !== "calendar");
  return {
    search: typeof config.search === "string" ? config.search : "",
    filters: {
      status: Array.isArray(config.filters?.status) ? config.filters.status : [],
      tutorIds: Array.isArray(config.filters?.tutorIds) ? config.filters.tutorIds : [],
      courseIds: Array.isArray(config.filters?.courseIds) ? config.filters.courseIds : [],
      deliveryModes: Array.isArray(config.filters?.deliveryModes)
        ? config.filters.deliveryModes.filter(
            (mode): mode is "group" | "one_to_one" | "community" =>
              mode === "group" || mode === "one_to_one" || mode === "community"
          )
        : [],
    },
    groupBy:
      config.groupBy === "status" ||
      config.groupBy === "tutor" ||
      config.groupBy === "course" ||
      config.groupBy === "format"
        ? config.groupBy
        : "none",
    sort: {
      field:
        config.sort?.field === "name" || config.sort?.field === "format"
          ? config.sort.field
          : "startDate",
      direction: config.sort?.direction === "asc" ? "asc" : "desc",
    },
    columns: {
      hidden,
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

export async function savePackagesView(
  name: string,
  config: PackagesViewConfig
): Promise<ActionResult & { id?: string }> {
  try {
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const supabase = await requireAdminFromActions();
    const { data, error } = await supabase
      .from("admin_saved_views")
      .insert({
        name: name.trim(),
        view_type: "packages",
        config,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };
    return { success: "View saved.", id: data?.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save view." };
  }
}

export async function updatePackagesSavedView(
  viewId: string,
  updates: { name?: string; config?: PackagesViewConfig }
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.config !== undefined) payload.config = updates.config;
    if (Object.keys(payload).length === 0) {
      return { success: "Nothing to update." };
    }

    const { error } = await supabase.from("admin_saved_views").update(payload).eq("id", viewId);
    if (error) return { error: error.message };
    return { success: "View updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update view." };
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
