"use server";

import { requireAdminFromActions, type ActionResult } from "@/app/admin/content/actions";
import { getDisplayName } from "@/lib/profile/display-name";
import {
  autoLinkAllUnresolvedInbox,
  linkInboxRowToPackageInstance,
} from "@/lib/notion/package-sync";
import {
  dismissNotionInboxRows,
  INBOX_DISMISSAL_REASON_NOT_A_REAL_PACKAGE,
} from "@/lib/notion/notion-inbox-dismiss";
import {
  loadPackageCatalog,
  resolveNotionSyncTargetFromPage,
} from "@/lib/notion/resolve-package-link";
import { loadLeadLinkAdminSnapshot, upsertNotionLeadsCache } from "@/lib/notion/lead-sync";
import { notionJson } from "@/lib/notion/client";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { revalidatePath } from "next/cache";

const NOTION_SYNC_PATH = "/admin/packages/notion";

function revalidateNotionSync() {
  revalidatePath(NOTION_SYNC_PATH);
  revalidatePath("/admin/packages");
}

export async function refreshNotionPackageInbox(): Promise<{
  rows: Array<{
    id: string;
    notionPageId: string;
    packageName: string | null;
    startDate: string | null;
    endDate: string | null;
    status: string | null;
    notionTutorUserId: string | null;
    createdAt: string;
    resolvedPackageName: string | null;
    resolvedCourseName: string | null;
    skipReason: string | null;
  }>;
  autoLinked: number;
  error?: string;
}> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const autoLink = await autoLinkAllUnresolvedInbox(supabase);
    if (autoLink.linked > 0) {
      revalidateNotionSync();
    }
    const catalog = await loadPackageCatalog(supabase);
    const activePackages = catalog.packages.filter((pkg) => pkg.active !== false);

    const { data, error } = await supabase
      .from("notion_sync_inbox")
      .select(
        "id, notion_page_id, package_name, start_date, end_date, status, notion_tutor_user_id, created_at, raw_properties"
      )
      .eq("resolved", false)
      .order("created_at", { ascending: false });

    if (error) {
      return { rows: [], autoLinked: autoLink.linked, error: error.message };
    }

    return {
      autoLinked: autoLink.linked,
      rows: (data ?? []).map((row) => {
        const resolved = resolveNotionSyncTargetFromPage(
          {
            packageName: row.package_name,
            rawProperties: (row.raw_properties as Record<string, unknown>) ?? {},
          },
          activePackages,
          catalog.courses
        );

        return {
          id: row.id,
          notionPageId: row.notion_page_id,
          packageName: row.package_name,
          startDate: row.start_date,
          endDate: row.end_date,
          status: row.status,
          notionTutorUserId: row.notion_tutor_user_id,
          createdAt: row.created_at,
          resolvedPackageName: resolved.ok ? resolved.link.packageName : null,
          resolvedCourseName: resolved.ok ? resolved.link.courseName : null,
          skipReason: resolved.ok ? null : resolved.detail,
        };
      }),
    };
  } catch (e) {
    return {
      rows: [],
      autoLinked: 0,
      error: e instanceof Error ? e.message : "Failed to load Notion inbox.",
    };
  }
}

/** @deprecated Use refreshNotionPackageInbox — kept for compatibility. */
export async function fetchNotionSyncInbox() {
  return refreshNotionPackageInbox();
}

export async function fetchNotionTutorMapData(): Promise<{
  tutors: Array<{ id: string; name: string }>;
  mappings: Array<{
    id: string;
    tutorId: string;
    tutorName: string;
    notionUserId: string;
    notionUserName: string | null;
  }>;
  error?: string;
}> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();

    const [{ data: roleRows }, { data: profiles }, { data: mappings, error: mapError }] =
      await Promise.all([
        supabase.from("profile_roles").select("user_id").eq("role", "tutor"),
        supabase.from("profiles").select("id, full_name, preferred_name"),
        supabase
          .from("notion_tutor_map")
          .select("id, tutor_id, notion_user_id, notion_user_name")
          .order("created_at", { ascending: true }),
      ]);

    if (mapError) return { tutors: [], mappings: [], error: mapError.message };

    const tutorIds = new Set((roleRows ?? []).map((row) => row.user_id));
    const profileById = new Map((profiles ?? []).map((row) => [row.id, row] as const));

    const tutors = [...tutorIds]
      .map((id) => {
        const profile = profileById.get(id);
        return {
          id,
          name: getDisplayName(profile) ?? id.slice(0, 8),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      tutors,
      mappings: (mappings ?? []).map((row) => ({
        id: row.id,
        tutorId: row.tutor_id,
        tutorName: getDisplayName(profileById.get(row.tutor_id)) ?? row.tutor_id.slice(0, 8),
        notionUserId: row.notion_user_id,
        notionUserName: row.notion_user_name,
      })),
    };
  } catch (e) {
    return {
      tutors: [],
      mappings: [],
      error: e instanceof Error ? e.message : "Failed to load tutor map.",
    };
  }
}

export async function searchNotionWorkspaceUsers(query: string): Promise<{
  users: Array<{ id: string; name: string; type: string }>;
  error?: string;
}> {
  try {
    await requireAdminFromActions();
    const needle = query.trim().toLowerCase();
    type NotionUsersPage = {
      results: Array<{ id: string; name?: string; type?: string }>;
      has_more: boolean;
      next_cursor: string | null;
    };

    const firstPage = await notionJson<NotionUsersPage>("/users");

    const allUsers: Array<{ id: string; name: string; type: string }> = [];
    let cursor: string | null = null;
    let page: NotionUsersPage = firstPage;

    while (true) {
      for (const user of page.results ?? []) {
        if (user.type !== "person") continue;
        allUsers.push({
          id: user.id,
          name: user.name ?? user.id,
          type: user.type,
        });
      }

      if (!page.has_more || !page.next_cursor) break;
      cursor = page.next_cursor;
      page = await notionJson<NotionUsersPage>(`/users?start_cursor=${cursor}`);
    }

    const users = allUsers
      .filter((user) => !needle || user.name.toLowerCase().includes(needle))
      .slice(0, 20);

    return { users };
  } catch (e) {
    return {
      users: [],
      error: e instanceof Error ? e.message : "Failed to search Notion users.",
    };
  }
}

export async function saveNotionTutorMapping(
  tutorId: string,
  notionUserId: string,
  notionUserName: string | null
): Promise<ActionResult> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("notion_tutor_map").upsert(
      {
        tutor_id: tutorId,
        notion_user_id: notionUserId.trim(),
        notion_user_name: notionUserName?.trim() || null,
      },
      { onConflict: "tutor_id" }
    );

    if (error) return { error: error.message };
    revalidateNotionSync();
    return { success: "Tutor mapping saved." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save tutor mapping." };
  }
}

export async function deleteNotionTutorMapping(mappingId: string): Promise<ActionResult> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("notion_tutor_map").delete().eq("id", mappingId);
    if (error) return { error: error.message };
    revalidateNotionSync();
    return { success: "Tutor mapping removed." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete tutor mapping." };
  }
}

export async function linkNotionInboxRow(
  inboxId: string,
  packageId: string,
  courseId: string
): Promise<ActionResult & { id?: string }> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const result = await linkInboxRowToPackageInstance(supabase, inboxId, packageId, courseId);
    if (!result.ok) return { error: result.error ?? "Failed to link inbox row." };
    revalidateNotionSync();
    return { success: "Package linked and instance created.", id: result.instanceId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to link inbox row." };
  }
}

export async function dismissNotionInboxRow(
  inboxId: string
): Promise<ActionResult> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const result = await dismissNotionInboxRows(supabase, [inboxId], INBOX_DISMISSAL_REASON_NOT_A_REAL_PACKAGE);
    if (result.error) return { error: result.error };
    if (result.dismissed === 0) {
      return { error: "Inbox row not found or already resolved." };
    }
    revalidateNotionSync();
    return { success: "Dismissed — marked as not a real package." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to dismiss inbox row." };
  }
}

export async function fetchLeadLinkAdminData() {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    return loadLeadLinkAdminSnapshot(supabase);
  } catch (e) {
    return {
      unlinkedProfiles: [],
      conflicts: [],
      error: e instanceof Error ? e.message : "Failed to load lead link data.",
    };
  }
}

export async function refreshNotionLeadsCache(
  fullSync = false
): Promise<
  ActionResult & {
    upserted?: number;
    notionPageCount?: number;
    rosterCachesPatched?: number;
  }
> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const result = await upsertNotionLeadsCache(supabase, { fullSync });
    revalidateNotionSync();
    if (result.errors.length > 0) {
      return {
        error: `Upserted ${result.upserted}. First error: ${result.errors[0]}`,
        upserted: result.upserted,
        notionPageCount: result.notionPageCount,
        rosterCachesPatched: result.rosterCachesPatched,
      };
    }
    return {
      success: result.fullSync
        ? `Full leads sync: ${result.upserted} upserted, ${result.rosterCachesPatched} package roster cache${result.rosterCachesPatched === 1 ? "" : "s"} patched.`
        : `Synced ${result.upserted} lead${result.upserted === 1 ? "" : "s"} (${result.rosterCachesPatched} roster cache${result.rosterCachesPatched === 1 ? "" : "s"} patched).`,
      upserted: result.upserted,
      notionPageCount: result.notionPageCount,
      rosterCachesPatched: result.rosterCachesPatched,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Leads cache sync failed." };
  }
}

export async function fetchLeadPurchaseGrantQueue(): Promise<{
  rows: Awaited<ReturnType<typeof import("@/lib/notion/lead-purchase-access-grant").loadLeadPurchaseGrantQueue>>;
  cohorts: Array<{ id: string; name: string }>;
  packageInstances: Array<{ id: string; name: string }>;
  error?: string;
}> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const { loadLeadPurchaseGrantQueue } = await import(
      "@/lib/notion/lead-purchase-access-grant"
    );
    const [rows, { data: cohorts }, { data: packageInstances }] = await Promise.all([
      loadLeadPurchaseGrantQueue(supabase),
      supabase.from("cohorts").select("id, name").order("name", { ascending: true }).limit(200),
      supabase
        .from("package_instances")
        .select("id, name")
        .order("name", { ascending: true })
        .limit(200),
    ]);
    return {
      rows,
      cohorts: (cohorts ?? []).map((c) => ({ id: c.id, name: c.name })),
      packageInstances: (packageInstances ?? []).map((p) => ({
        id: p.id,
        name: p.name ?? "Untitled instance",
      })),
    };
  } catch (e) {
    return {
      rows: [],
      cohorts: [],
      packageInstances: [],
      error: e instanceof Error ? e.message : "Failed to load purchase grant queue.",
    };
  }
}

export async function resolveLeadPurchaseGrantQueueItemAction(
  queueId: string,
  action: "dismiss" | "grant",
  options?: {
    kind?: "cohort" | "package_instance";
    runId?: string;
    note?: string;
  }
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const { createClient } = await import("@/lib/supabase/server");
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { resolveLeadPurchaseGrantQueueItem } = await import(
      "@/lib/notion/lead-purchase-access-grant"
    );
    const result = await resolveLeadPurchaseGrantQueueItem(supabase, {
      queueId,
      resolvedBy: user.id,
      action,
      kind: options?.kind,
      runId: options?.runId,
      note: options?.note,
    });
    if (result.error) return { error: result.error };
    revalidateNotionSync();
    return { success: result.success ?? "Resolved." };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to resolve purchase grant queue item.",
    };
  }
}

export async function fetchNotionLinkFormOptions(): Promise<{
  packages: Array<{ id: string; name: string; courseId: string; courseName: string }>;
  error?: string;
}> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const [{ data: packages }, { data: courses }] = await Promise.all([
      supabase
        .from("packages")
        .select("id, name, course_id, delivery_mode")
        .order("display_order", { ascending: true }),
      supabase.from("courses").select("id, name").order("display_order", { ascending: true }),
    ]);

    const courseNameById = new Map((courses ?? []).map((row) => [row.id, row.name] as const));

    return {
      packages: (packages ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        courseId: row.course_id,
        courseName: courseNameById.get(row.course_id) ?? "Unknown course",
      })),
    };
  } catch (e) {
    return { packages: [], error: e instanceof Error ? e.message : "Failed to load options." };
  }
}
