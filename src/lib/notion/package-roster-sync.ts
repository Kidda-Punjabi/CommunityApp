import type { PackageMembershipStatus } from "@/lib/admin/package-status";
import {
  notionJson,
  plainTextFromRichText,
  plainTextFromTitle,
  relationIds,
} from "@/lib/notion/client";
import { listNotionLinkedCohortIds } from "@/lib/notion/notion-cohort-link";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NotionRosterStatus = "interested" | "waiting_for_payment" | "confirmed";

type NotionLeadPage = {
  id: string;
  properties: Record<string, unknown>;
};

const ROSTER_PROPERTY_MAP: Array<{ property: string; status: NotionRosterStatus }> = [
  { property: "Interested", status: "interested" },
  { property: "Waiting for Payment", status: "waiting_for_payment" },
  { property: "Confirmed", status: "confirmed" },
];

export function parseNotionPackageRosterFromProperties(
  rawProperties: Record<string, unknown>
): Array<{ notionLeadPageId: string; rosterStatus: NotionRosterStatus }> {
  const props = rawProperties as Record<string, { relation?: Array<{ id?: string }> }>;
  const entries: Array<{ notionLeadPageId: string; rosterStatus: NotionRosterStatus }> = [];

  for (const { property, status } of ROSTER_PROPERTY_MAP) {
    for (const leadPageId of relationIds(props[property])) {
      entries.push({ notionLeadPageId: leadPageId, rosterStatus: status });
    }
  }

  return entries;
}

function leadNameFromPage(page: NotionLeadPage): string {
  const props = page.properties as Record<string, { title?: Array<{ plain_text?: string }> }>;
  for (const [, value] of Object.entries(props)) {
    if (value && "title" in value) {
      const name = plainTextFromTitle(value);
      if (name) return name;
    }
  }
  return page.id.slice(0, 8);
}

function leadEmailFromPage(page: NotionLeadPage): string | null {
  const props = page.properties as Record<
    string,
    { email?: string; rich_text?: Array<{ plain_text?: string }> }
  >;
  for (const key of ["Email", "Email (Copy)"]) {
    const prop = props[key];
    if (!prop) continue;
    if ("email" in prop && prop.email?.trim()) return prop.email.trim();
    const fromRichText = plainTextFromRichText(prop);
    if (fromRichText) return fromRichText;
  }
  return null;
}

function appUserIdFromPage(page: NotionLeadPage): string | null {
  const props = page.properties as Record<string, { rich_text?: Array<{ plain_text?: string }> }>;
  return plainTextFromRichText(props["App User ID"]) || null;
}

async function fetchNotionLeadPages(leadPageIds: string[]): Promise<Map<string, NotionLeadPage>> {
  const byId = new Map<string, NotionLeadPage>();
  const uniqueIds = [...new Set(leadPageIds)];
  const batchSize = 10;

  for (let index = 0; index < uniqueIds.length; index += batchSize) {
    const batch = uniqueIds.slice(index, index + batchSize);
    const pages = await Promise.all(
      batch.map((pageId) =>
        notionJson<NotionLeadPage>(`/pages/${pageId}`).catch(() => null)
      )
    );
    for (const page of pages) {
      if (page) byId.set(page.id, page);
    }
  }

  return byId;
}

export type NotionRosterTarget =
  | { kind: "package_instance"; id: string }
  | { kind: "cohort"; id: string };

export async function syncNotionRosterFromPage(
  supabase: SupabaseClient,
  target: NotionRosterTarget,
  rawProperties: Record<string, unknown>,
  notionPageId?: string | null
): Promise<{ synced: number; error?: string }> {
  const rosterEntries = parseNotionPackageRosterFromProperties(rawProperties);
  const leadPageIds = rosterEntries.map((entry) => entry.notionLeadPageId);

  const [leadPagesById, profileLinks, studentPackageLinks] = await Promise.all([
    fetchNotionLeadPages(leadPageIds),
    loadProfileIdsByNotionLeadPageId(supabase, leadPageIds),
    target.kind === "package_instance"
      ? loadStudentPackagesByNotionLeadPageId(supabase, target.id, leadPageIds)
      : loadStudentPackagesByCohortAndLeads(supabase, target.id, leadPageIds),
  ]);

  const cachedRows = rosterEntries
    .map((entry) => {
      const leadPage = leadPagesById.get(entry.notionLeadPageId);
      if (!leadPage) return null;

      const profileId =
        profileLinks.get(entry.notionLeadPageId) ?? appUserIdFromPage(leadPage) ?? null;

      const base = {
        notion_lead_page_id: entry.notionLeadPageId,
        lead_name: leadNameFromPage(leadPage),
        lead_email: leadEmailFromPage(leadPage),
        roster_status: entry.rosterStatus,
        profile_id: profileId,
        student_package_id:
          studentPackageLinks.get(entry.notionLeadPageId) ??
          (profileId ? studentPackageLinks.get(`profile:${profileId}`) ?? null : null),
        synced_at: new Date().toISOString(),
      };

      if (target.kind === "package_instance") {
        return { ...base, package_instance_id: target.id, cohort_id: null };
      }
      return { ...base, cohort_id: target.id, package_instance_id: null };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const { error: tableProbeError } = await supabase
    .from("package_instance_notion_roster")
    .select("id")
    .limit(1);

  if (!tableProbeError) {
    const deleteQuery = supabase.from("package_instance_notion_roster").delete();
    if (target.kind === "package_instance") {
      await deleteQuery.eq("package_instance_id", target.id);
    } else {
      await deleteQuery.eq("cohort_id", target.id);
    }

    if (cachedRows.length > 0) {
      const { error: insertError } = await supabase
        .from("package_instance_notion_roster")
        .insert(cachedRows);

      if (insertError) {
        return { synced: 0, error: insertError.message };
      }
    }
  }

  if (notionPageId) {
    const { data: inboxRow } = await supabase
      .from("notion_sync_inbox")
      .select("id, raw_properties")
      .eq("notion_page_id", notionPageId)
      .maybeSingle();

    if (inboxRow) {
      const { error: inboxError } = await supabase
        .from("notion_sync_inbox")
        .update({
          raw_properties: {
            ...(inboxRow.raw_properties as Record<string, unknown>),
            _roster_cache: cachedRows.map((row) => ({
              notionLeadPageId: row.notion_lead_page_id,
              leadName: row.lead_name,
              leadEmail: row.lead_email,
              rosterStatus: row.roster_status,
              profileId: row.profile_id,
              studentPackageId: row.student_package_id,
            })),
          },
        })
        .eq("id", inboxRow.id);

      if (inboxError && tableProbeError) {
        return { synced: 0, error: inboxError.message };
      }
    }
  }

  return { synced: cachedRows.length };
}

export async function syncPackageInstanceRosterFromNotion(
  supabase: SupabaseClient,
  packageInstanceId: string,
  rawProperties: Record<string, unknown>,
  notionPageId?: string | null
): Promise<{ synced: number; error?: string }> {
  return syncNotionRosterFromPage(
    supabase,
    { kind: "package_instance", id: packageInstanceId },
    rawProperties,
    notionPageId
  );
}

export async function syncCohortRosterFromNotion(
  supabase: SupabaseClient,
  cohortId: string,
  rawProperties: Record<string, unknown>,
  notionPageId?: string | null
): Promise<{ synced: number; error?: string }> {
  return syncNotionRosterFromPage(
    supabase,
    { kind: "cohort", id: cohortId },
    rawProperties,
    notionPageId
  );
}

async function loadProfileIdsByNotionLeadPageId(
  supabase: SupabaseClient,
  leadPageIds: string[]
): Promise<Map<string, string>> {
  if (leadPageIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, notion_lead_page_id")
    .in("notion_lead_page_id", leadPageIds);

  if (error) throw new Error(error.message);

  return new Map(
    (data ?? [])
      .filter((row) => row.notion_lead_page_id)
      .map((row) => [row.notion_lead_page_id!, row.id] as const)
  );
}

async function loadStudentPackagesByNotionLeadPageId(
  supabase: SupabaseClient,
  packageInstanceId: string,
  leadPageIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (leadPageIds.length === 0) return map;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, notion_lead_page_id")
    .in("notion_lead_page_id", leadPageIds);

  const profileIds = (profiles ?? []).map((row) => row.id);
  if (profileIds.length === 0) return map;

  const { data: studentPackages } = await supabase
    .from("student_packages")
    .select("id, user_id, package_instance_id")
    .eq("package_instance_id", packageInstanceId)
    .in("user_id", profileIds);

  const profileByLeadPageId = new Map(
    (profiles ?? [])
      .filter((row) => row.notion_lead_page_id)
      .map((row) => [row.notion_lead_page_id!, row.id] as const)
  );

  for (const sp of studentPackages ?? []) {
    for (const [leadPageId, profileId] of profileByLeadPageId) {
      if (profileId === sp.user_id) {
        map.set(leadPageId, sp.id);
        map.set(`profile:${profileId}`, sp.id);
      }
    }
  }

  return map;
}

async function loadStudentPackagesByCohortAndLeads(
  supabase: SupabaseClient,
  cohortId: string,
  leadPageIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (leadPageIds.length === 0) return map;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, notion_lead_page_id")
    .in("notion_lead_page_id", leadPageIds);

  const profileIds = (profiles ?? []).map((row) => row.id);
  if (profileIds.length === 0) return map;

  const { data: enrollments } = await supabase
    .from("course_enrollments")
    .select("id, user_id")
    .eq("cohort_id", cohortId)
    .in("user_id", profileIds);

  const enrollmentIds = (enrollments ?? []).map((row) => row.id);
  if (enrollmentIds.length === 0) return map;

  const { data: studentPackages } = await supabase
    .from("student_packages")
    .select("id, user_id, enrollment_id")
    .in("enrollment_id", enrollmentIds);

  const enrollmentByUserId = new Map(
    (enrollments ?? []).map((row) => [row.user_id, row.id] as const)
  );
  const profileByLeadPageId = new Map(
    (profiles ?? [])
      .filter((row) => row.notion_lead_page_id)
      .map((row) => [row.notion_lead_page_id!, row.id] as const)
  );

  for (const sp of studentPackages ?? []) {
    for (const [leadPageId, profileId] of profileByLeadPageId) {
      if (profileId === sp.user_id) {
        map.set(leadPageId, sp.id);
        map.set(`profile:${profileId}`, sp.id);
      }
    }
  }

  return map;
}

export async function syncAllNotionLinkedPackageRosters(
  supabase: SupabaseClient
): Promise<{ synced: number; errors: string[] }> {
  const { data: instances, error: instanceError } = await supabase
    .from("package_instances")
    .select("id, notion_page_id")
    .not("notion_page_id", "is", null);

  if (instanceError) throw new Error(instanceError.message);

  const cohortLinks = await listNotionLinkedCohortIds(supabase);
  const cohortEntries = [...cohortLinks.entries()].map(([notionPageId, cohortId]) => ({
    id: cohortId,
    notion_page_id: notionPageId,
  }));

  let synced = 0;
  const errors: string[] = [];

  for (const instance of instances ?? []) {
    try {
      const page = await notionJson<{ properties: Record<string, unknown> }>(
        `/pages/${instance.notion_page_id}`
      );
      const result = await syncPackageInstanceRosterFromNotion(
        supabase,
        instance.id,
        page.properties,
        instance.notion_page_id
      );
      if (result.error) errors.push(`${instance.id}: ${result.error}`);
      else synced += result.synced;
    } catch (e) {
      errors.push(`${instance.id}: ${e instanceof Error ? e.message : "Failed to sync roster."}`);
    }
  }

  for (const cohort of cohortEntries) {
    try {
      const page = await notionJson<{ properties: Record<string, unknown> }>(
        `/pages/${cohort.notion_page_id}`
      );
      const result = await syncCohortRosterFromNotion(
        supabase,
        cohort.id,
        page.properties,
        cohort.notion_page_id
      );
      if (result.error) errors.push(`${cohort.id}: ${result.error}`);
      else synced += result.synced;
    } catch (e) {
      errors.push(`${cohort.id}: ${e instanceof Error ? e.message : "Failed to sync roster."}`);
    }
  }

  return { synced, errors };
}

export function notionRosterStatusToMembershipStatus(
  status: NotionRosterStatus
): PackageMembershipStatus {
  return status;
}
