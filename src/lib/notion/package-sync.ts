import type { PackageInstanceStatus } from "@/lib/admin/package-status";
import { normalizeCalendarDateFromIso } from "@/lib/admin/package-schedule";
import { readNotionStartDateDetails } from "@/lib/notion/notion-start-date";
import { countNotionConfirmedRelations } from "@/lib/notion/package-roster-sync";
import {
  cohortDisplayNameFromNotionPage,
  loadPackageCatalog,
  readNotionCourseLabel,
  readNotionDeliveryType,
  readNotionStartDayOfWeek,
  resolveNotionSyncTargetFromPage,
  resolvePackageLinkFromNotionPage,
  type ResolvedNotionSyncTarget,
} from "@/lib/notion/resolve-package-link";
import {
  cohortNotionColumnsAvailable,
  getCohortIdForNotionPage,
  inboxCohortLinkColumnAvailable,
  listNotionLinkedCohortIds,
  saveCohortNotionLink,
} from "@/lib/notion/notion-cohort-link";
import {
  syncCohortRosterFromNotion,
  syncPackageInstanceRosterFromNotion,
} from "@/lib/notion/package-roster-sync";
import { isManualTutorSource, omitTutorFromPullPatchIfManual } from "@/lib/notion/tutor-id-source";
import {
  NOTION_PACKAGE_DATA_SOURCE_ID,
  dateStart,
  notionJson,
  peopleIds,
  plainTextFromTitle,
  selectName,
  statusName,
} from "@/lib/notion/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PACKAGE_SYNC_FIELDS = [
  "name",
  "start_date",
  "end_date",
  "status",
  "tutor_id",
] as const;

export type PackageInstanceSyncRow = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: PackageInstanceStatus;
  tutor_id: string | null;
  notion_page_id: string | null;
  notion_synced_at: string | null;
  updated_at: string;
};

export const STATUS_TO_NOTION: Record<PackageInstanceStatus, string> = {
  pre_scheduling: "Pre-scheduling",
  recruiting: "Recruiting",
  scheduled: "Scheduled",
  in_progress: "In progress",
  paused: "Paused",
  postponed: "Postponed",
  incomplete: "Incomplete",
  classes_completed: "Classes Completed",
  offboarding_complete: "Offboarding Complete",
};

const NOTION_TO_STATUS = Object.fromEntries(
  Object.entries(STATUS_TO_NOTION).map(([db, notion]) => [notion, db])
) as Record<string, PackageInstanceStatus>;

type NotionPropertyValue =
  | { title: Array<{ text: { content: string } }> }
  | { select: { name: string } }
  | { status: { name: string } }
  | { date: { start: string } | null }
  | { people: Array<{ id: string }> };

export type ParsedNotionPackagePage = {
  pageId: string;
  lastEditedTime: string;
  packageName: string | null;
  startDate: string | null;
  endDate: string | null;
  status: PackageInstanceStatus | null;
  notionTutorUserId: string | null;
  rawProperties: Record<string, unknown>;
};

export function notionStatusFromDb(status: PackageInstanceStatus): string {
  return STATUS_TO_NOTION[status];
}

export function dbStatusFromNotion(name: string | null): PackageInstanceStatus | null {
  if (!name) return null;
  return NOTION_TO_STATUS[name] ?? null;
}

export function packageSyncFieldsChanged(
  oldRecord: Record<string, unknown> | null,
  newRecord: Record<string, unknown>
): boolean {
  if (!oldRecord) return true;
  return PACKAGE_SYNC_FIELDS.some((field) => oldRecord[field] !== newRecord[field]);
}

export async function loadNotionTutorMap(
  supabase: SupabaseClient
): Promise<{
  byTutorId: Map<string, { notionUserId: string; notionUserName: string | null }>;
  byNotionUserId: Map<string, { tutorId: string; notionUserName: string | null }>;
}> {
  const { data, error } = await supabase
    .from("notion_tutor_map")
    .select("tutor_id, notion_user_id, notion_user_name");

  if (error) throw new Error(error.message);

  const byTutorId = new Map<string, { notionUserId: string; notionUserName: string | null }>();
  const byNotionUserId = new Map<string, { tutorId: string; notionUserName: string | null }>();

  for (const row of data ?? []) {
    byTutorId.set(row.tutor_id, {
      notionUserId: row.notion_user_id,
      notionUserName: row.notion_user_name,
    });
    byNotionUserId.set(row.notion_user_id, {
      tutorId: row.tutor_id,
      notionUserName: row.notion_user_name,
    });
  }

  return { byTutorId, byNotionUserId };
}

/** Maps Notion package page Tutor person → app profiles.id via notion_tutor_map.
 * Returns undefined when Notion has a Tutor but no map row (caller should not clobber existing tutor_id).
 * Returns null when Notion has no Tutor person (caller may clear).
 */
export function tutorIdFromNotionPackagePage(
  page: ParsedNotionPackagePage,
  byNotionUserId: Map<string, { tutorId: string; notionUserName: string | null }>
): string | null | undefined {
  if (!page.notionTutorUserId) return null;
  const mapped = byNotionUserId.get(page.notionTutorUserId);
  if (!mapped) return undefined;
  return mapped.tutorId;
}

export function cohortPullPatchFromNotionPage(
  page: ParsedNotionPackagePage,
  byNotionUserId: Map<string, { tutorId: string; notionUserName: string | null }>
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    name: cohortDisplayNameFromNotionPage(page),
    start_date: page.startDate,
    end_date: page.endDate,
    start_day_of_week: readNotionStartDayOfWeek(page),
    ...(page.status ? { status: page.status } : {}),
    ...cohortWeeklySessionPatchFromNotionPage(page),
  };
  const tutorId = tutorIdFromNotionPackagePage(page, byNotionUserId);
  if (tutorId !== undefined) {
    patch.tutor_id = tutorId;
    patch.tutor_id_source = "notion";
  }
  return patch;
}

export function packageInstancePullPatchFromNotionPage(
  page: ParsedNotionPackagePage,
  byNotionUserId: Map<string, { tutorId: string; notionUserName: string | null }>
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    start_date: page.startDate,
    end_date: page.endDate,
    start_day_of_week: readNotionStartDayOfWeek(page),
    ...(page.packageName ? { name: page.packageName } : {}),
    ...(page.status ? { status: page.status } : {}),
  };
  const tutorId = tutorIdFromNotionPackagePage(page, byNotionUserId);
  if (tutorId !== undefined) {
    patch.tutor_id = tutorId;
    patch.tutor_id_source = "notion";
  }
  return patch;
}

export async function buildPackageNotionProperties(
  row: Pick<
    PackageInstanceSyncRow,
    "name" | "start_date" | "end_date" | "status" | "tutor_id"
  >,
  tutorMap: Map<string, { notionUserId: string; notionUserName: string | null }>
): Promise<{ properties: Record<string, NotionPropertyValue>; skippedTutor: boolean }> {
  const properties: Record<string, NotionPropertyValue> = {
    "Package Name": {
      title: [{ text: { content: row.name } }],
    },
    Status: {
      status: { name: notionStatusFromDb(row.status) },
    },
  };

  if (row.start_date) {
    properties["Start Date"] = { date: { start: row.start_date } };
  } else {
    properties["Start Date"] = { date: null };
  }

  if (row.end_date) {
    properties["End Date"] = { date: { start: row.end_date } };
  } else {
    properties["End Date"] = { date: null };
  }

  let skippedTutor = false;
  if (row.tutor_id) {
    const mapped = tutorMap.get(row.tutor_id);
    if (mapped) {
      properties.Tutor = { people: [{ id: mapped.notionUserId }] };
    } else {
      skippedTutor = true;
      console.warn(
        `[notion package sync] Skipping Tutor for package instance ${row.name}: no notion_tutor_map row for tutor_id ${row.tutor_id}`
      );
    }
  }

  return { properties, skippedTutor };
}

export function parseNotionPackagePage(page: {
  id: string;
  last_edited_time: string;
  properties: Record<string, unknown>;
}): ParsedNotionPackagePage {
  const props = page.properties as Record<
    string,
    | { title?: Array<{ plain_text?: string }> }
    | { select?: { name?: string } | null }
    | { date?: { start?: string } | null }
    | { people?: Array<{ id?: string }> }
  >;

  const tutorIds = peopleIds(props.Tutor as { people?: Array<{ id?: string }> });
  const startDateDetails = readNotionStartDateDetails(page.properties);

  return {
    pageId: page.id,
    lastEditedTime: page.last_edited_time,
    packageName:
      plainTextFromTitle(
        props["Package Name"] as { title?: Array<{ plain_text?: string }> }
      ) || null,
    startDate: startDateDetails.calendarStartIso,
    endDate: normalizeCalendarDateFromIso(
      dateStart(props["End Date"] as { date?: { start?: string } | null })
    ),
    status: dbStatusFromNotion(
      statusName(props.Status as { status?: { name?: string } | null }) ??
        selectName(props.Status as { select?: { name?: string } | null })
    ),
    notionTutorUserId: tutorIds[0] ?? null,
    rawProperties: page.properties,
  };
}

export function cohortWeeklySessionPatchFromNotionPage(
  page: ParsedNotionPackagePage
): Record<string, unknown> {
  const startDateDetails = readNotionStartDateDetails(page.rawProperties);
  return {
    weekly_session_start: startDateDetails.weeklySessionStartIso,
    weekly_session_end: startDateDetails.weeklySessionEndIso,
    weekly_session_has_time: startDateDetails.weeklySessionHasTime,
    notion_confirmed_count: countNotionConfirmedRelations(page.rawProperties),
  };
}

export async function createNotionPackagePage(
  properties: Record<string, NotionPropertyValue>
): Promise<string> {
  const data = await notionJson<{ id: string }>("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: NOTION_PACKAGE_DATA_SOURCE_ID },
      properties,
    }),
  });
  return data.id;
}

export async function updateNotionPackagePage(
  pageId: string,
  properties: Record<string, NotionPropertyValue>
): Promise<void> {
  await notionJson(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
}

type NotionQueryResponse = {
  results: Array<{
    id: string;
    last_edited_time: string;
    properties: Record<string, unknown>;
  }>;
  has_more: boolean;
  next_cursor: string | null;
};

export async function queryNotionPackagePagesEditedAfter(
  editedAfter: string | null
): Promise<ParsedNotionPackagePage[]> {
  const pages: ParsedNotionPackagePage[] = [];
  let cursor: string | null = null;

  do {
    const body: Record<string, unknown> = {
      page_size: 100,
      sorts: [{ timestamp: "last_edited_time", direction: "ascending" }],
    };

    if (editedAfter) {
      body.filter = {
        timestamp: "last_edited_time",
        last_edited_time: { after: editedAfter },
      };
    }

    if (cursor) body.start_cursor = cursor;

    const data = await notionJson<NotionQueryResponse>(
      `/databases/${NOTION_PACKAGE_DATA_SOURCE_ID}/query`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    for (const result of data.results) {
      pages.push(parseNotionPackagePage(result));
    }

    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  return pages;
}

export async function pushPackageInstanceToNotion(
  supabase: SupabaseClient,
  instanceId: string
): Promise<{ ok: boolean; error?: string; skippedTutor?: boolean }> {
  const { data: row, error: loadError } = await supabase
    .from("package_instances")
    .select(
      "id, name, start_date, end_date, status, tutor_id, notion_page_id, notion_synced_at, updated_at"
    )
    .eq("id", instanceId)
    .maybeSingle();

  if (loadError || !row) {
    return { ok: false, error: loadError?.message ?? "Package instance not found." };
  }

  const { byTutorId } = await loadNotionTutorMap(supabase);
  const { properties, skippedTutor } = await buildPackageNotionProperties(
    row as PackageInstanceSyncRow,
    byTutorId
  );

  try {
    let pageId = row.notion_page_id;
    if (!pageId) {
      pageId = await createNotionPackagePage(properties);
    } else {
      await updateNotionPackagePage(pageId, properties);
    }

    const notionPage = await notionJson<{ last_edited_time: string }>(`/pages/${pageId}`);

    await supabase
      .from("package_instances")
      .update({
        notion_page_id: pageId,
        notion_sync_status: "synced",
        notion_synced_at: notionPage.last_edited_time,
        notion_sync_error: null,
      })
      .eq("id", instanceId);

    return { ok: true, skippedTutor };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notion sync failed.";
    await supabase
      .from("package_instances")
      .update({
        notion_sync_status: "error",
        notion_sync_error: message,
      })
      .eq("id", instanceId);

    return { ok: false, error: message, skippedTutor };
  }
}

const PACKAGE_PULL_CURSOR_VIEW_TYPE = "notion_package_pull_cursor";
const PACKAGE_PULL_CURSOR_NAME = "package_instances";

export async function loadPackagePullCursor(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data } = await supabase
    .from("admin_saved_views")
    .select("config")
    .eq("view_type", PACKAGE_PULL_CURSOR_VIEW_TYPE)
    .eq("name", PACKAGE_PULL_CURSOR_NAME)
    .maybeSingle();

  const cursor = (data?.config as { lastEditedTime?: string } | null)?.lastEditedTime;
  if (!cursor?.trim()) return null;

  // Overlap so Notion pages edited in the same second as the saved cursor are not missed.
  return new Date(new Date(cursor).getTime() - 3000).toISOString();
}

export async function savePackagePullCursor(
  supabase: SupabaseClient,
  lastEditedTime: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("admin_saved_views")
    .select("id")
    .eq("view_type", PACKAGE_PULL_CURSOR_VIEW_TYPE)
    .eq("name", PACKAGE_PULL_CURSOR_NAME)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("admin_saved_views")
      .update({ config: { lastEditedTime } })
      .eq("id", existing.id);
    return;
  }

  const { data: admin } = await supabase
    .from("profiles")
    .select("id")
    .eq("app_role", "master_admin")
    .limit(1)
    .maybeSingle();

  const createdBy =
    admin?.id ??
    (await supabase.from("profiles").select("id").limit(1).maybeSingle()).data?.id;

  if (!createdBy) return;

  await supabase.from("admin_saved_views").insert({
    name: PACKAGE_PULL_CURSOR_NAME,
    view_type: PACKAGE_PULL_CURSOR_VIEW_TYPE,
    config: { lastEditedTime },
    created_by: createdBy,
  });
}

export async function pullPackageInstancesFromNotion(
  supabase: SupabaseClient
): Promise<{
  pulled: number;
  inboxed: number;
  autoLinked: number;
  skipped: number;
  errors: string[];
}> {
  const cursor = await loadPackagePullCursor(supabase);
  const pages = await queryNotionPackagePagesEditedAfter(cursor);
  let pulled = 0;
  let inboxed = 0;
  let autoLinked = 0;
  let skipped = 0;
  const errors: string[] = [];
  let maxEdited = cursor;

  const { byNotionUserId } = await loadNotionTutorMap(supabase);
  const catalog = await loadPackageCatalog(supabase);
  const activePackages = catalog.packages.filter(
    (pkg) => (pkg as { active?: boolean }).active !== false
  );

  for (const page of pages) {
    if (!maxEdited || page.lastEditedTime > maxEdited) {
      maxEdited = page.lastEditedTime;
    }

    const [{ data: existingInstance }, existingCohortId] = await Promise.all([
      supabase
        .from("package_instances")
        .select("id, notion_synced_at, tutor_id_source")
        .eq("notion_page_id", page.pageId)
        .maybeSingle(),
      getCohortIdForNotionPage(supabase, page.pageId),
    ]);

    if (existingCohortId) {
      const notionColumns = await cohortNotionColumnsAvailable(supabase);
      const { data: existingCohort, error: cohortLoadError } = await supabase
        .from("cohorts")
        .select("id, tutor_id_source")
        .eq("id", existingCohortId)
        .maybeSingle();

      if (cohortLoadError || !existingCohort) {
        errors.push(`${page.pageId}: Linked cohort ${existingCohortId} not found.`);
        continue;
      }

      const cohortPatch: Record<string, unknown> = omitTutorFromPullPatchIfManual(
        cohortPullPatchFromNotionPage(page, byNotionUserId),
        existingCohort.tutor_id_source
      );

      if (notionColumns) {
        cohortPatch.notion_sync_status = "synced";
        cohortPatch.notion_synced_at = new Date().toISOString();
        cohortPatch.notion_sync_error = null;
      }

      const { error } = await supabase
        .from("cohorts")
        .update(cohortPatch)
        .eq("id", existingCohort.id);

      if (error) {
        errors.push(`${page.pageId}: ${error.message}`);
      } else {
        pulled += 1;
        const rosterResult = await syncCohortRosterFromNotion(
          supabase,
          existingCohort.id,
          page.rawProperties,
          page.pageId
        );
        if (rosterResult.error) {
          errors.push(`${page.pageId} roster: ${rosterResult.error}`);
        } else {
          await saveCohortNotionLink(supabase, page.pageId, existingCohort.id, {
            packageName: page.packageName,
            startDate: page.startDate,
            endDate: page.endDate,
            status: page.status,
            notionTutorUserId: page.notionTutorUserId,
            rawProperties: page.rawProperties,
          });
        }
      }
      continue;
    }

    if (existingInstance) {
      const notionSyncedAt = existingInstance.notion_synced_at
        ? new Date(existingInstance.notion_synced_at).getTime()
        : 0;
      const notionEditedAt = new Date(page.lastEditedTime).getTime();

      if (notionEditedAt < notionSyncedAt) {
        skipped += 1;
        continue;
      }

      const patch = omitTutorFromPullPatchIfManual(
        packageInstancePullPatchFromNotionPage(page, byNotionUserId),
        existingInstance.tutor_id_source
      );

      const { error } = await supabase
        .from("package_instances")
        .update({
          ...patch,
          notion_sync_status: "synced",
          notion_synced_at: page.lastEditedTime,
          notion_sync_error: null,
        })
        .eq("id", existingInstance.id);

      if (error) {
        errors.push(`${page.pageId}: ${error.message}`);
      } else {
        pulled += 1;
        const rosterResult = await syncPackageInstanceRosterFromNotion(
          supabase,
          existingInstance.id,
          page.rawProperties,
          page.pageId
        );
        if (rosterResult.error) {
          errors.push(`${page.pageId} roster: ${rosterResult.error}`);
        }
      }
      continue;
    }

    const resolved = resolveNotionSyncTargetFromPage(page, activePackages, catalog.courses);
    if (resolved.ok) {
      if (resolved.link.kind === "cohort") {
        const created = await createOrUpdateCohortFromNotionPage(supabase, page, resolved.link);
        if (created.ok) {
          autoLinked += 1;
          continue;
        }
        errors.push(`${page.pageId}: ${created.error ?? "Cohort auto-link failed."}`);
      } else {
        const created = await createPackageInstanceFromNotionPage(
          supabase,
          page,
          resolved.link.packageId,
          resolved.link.courseId
        );
        if (created.ok) {
          autoLinked += 1;
          continue;
        }
        errors.push(`${page.pageId}: ${created.error ?? "Auto-link failed."}`);
      }
    }

    const { error: inboxError } = await supabase.from("notion_sync_inbox").upsert(
      {
        notion_page_id: page.pageId,
        package_name: page.packageName,
        start_date: page.startDate,
        end_date: page.endDate,
        status: page.status,
        notion_tutor_user_id: page.notionTutorUserId,
        raw_properties: {
          ...page.rawProperties,
          _link_hint: resolved.ok
            ? null
            : {
                reason: resolved.reason,
                detail: resolved.detail,
                suggestedCourse: readNotionCourseLabel(page),
                suggestedDelivery: readNotionDeliveryType(page),
              },
        },
        resolved: false,
      },
      { onConflict: "notion_page_id" }
    );

    if (inboxError) {
      errors.push(`${page.pageId}: ${inboxError.message}`);
    } else {
      inboxed += 1;
    }
  }

  if (maxEdited && maxEdited !== cursor) {
    await savePackagePullCursor(supabase, maxEdited);
  }

  return { pulled, inboxed, autoLinked, skipped, errors };
}

export async function createPackageInstanceFromNotionPage(
  supabase: SupabaseClient,
  page: ParsedNotionPackagePage,
  packageId: string,
  courseId: string
): Promise<{ ok: boolean; instanceId?: string; error?: string }> {
  const status = page.status ?? "pre_scheduling";
  const { byNotionUserId } = await loadNotionTutorMap(supabase);

  const mappedTutorId = tutorIdFromNotionPackagePage(page, byNotionUserId);
  const { data: instance, error: insertError } = await supabase
    .from("package_instances")
    .insert({
      package_id: packageId,
      course_id: courseId,
      name: page.packageName?.trim() || "Imported from Notion",
      status,
      start_date: page.startDate,
      end_date: page.endDate,
      start_day_of_week: readNotionStartDayOfWeek(page),
      tutor_id: mappedTutorId === undefined ? null : mappedTutorId,
      tutor_id_source: "notion",
      notion_page_id: page.pageId,
      notion_sync_status: "synced",
      notion_synced_at: page.lastEditedTime,
    })
    .select("id")
    .single();

  if (insertError || !instance) {
    return { ok: false, error: insertError?.message ?? "Failed to create package instance." };
  }

  const rosterResult = await syncPackageInstanceRosterFromNotion(
    supabase,
    instance.id,
    page.rawProperties,
    page.pageId
  );
  if (rosterResult.error) {
    return {
      ok: false,
      error: `Package created but roster sync failed: ${rosterResult.error}`,
      instanceId: instance.id,
    };
  }

  await supabase
    .from("notion_sync_inbox")
    .update({
      resolved: true,
      resolved_package_instance_id: instance.id,
      ...(await inboxCohortLinkColumnAvailable(supabase)
        ? { resolved_cohort_id: null }
        : {}),
    })
    .eq("notion_page_id", page.pageId);

  return { ok: true, instanceId: instance.id };
}

async function findCohortForNotionImport(
  supabase: SupabaseClient,
  page: ParsedNotionPackagePage,
  courseId: string,
  cohortName: string
): Promise<string | null> {
  const linkedId = await getCohortIdForNotionPage(supabase, page.pageId);
  if (linkedId) return linkedId;

  if (await cohortNotionColumnsAvailable(supabase)) {
    const { data: byNotion } = await supabase
      .from("cohorts")
      .select("id")
      .eq("notion_page_id", page.pageId)
      .maybeSingle();
    if (byNotion) return byNotion.id;
  }

  const { data: byName } = await supabase
    .from("cohorts")
    .select("id")
    .eq("course_id", courseId)
    .eq("name", cohortName)
    .maybeSingle();
  return byName?.id ?? null;
}

export async function createOrUpdateCohortFromNotionPage(
  supabase: SupabaseClient,
  page: ParsedNotionPackagePage,
  link: ResolvedNotionSyncTarget
): Promise<{ ok: boolean; cohortId?: string; error?: string }> {
  const status = page.status ?? "pre_scheduling";
  const { byNotionUserId } = await loadNotionTutorMap(supabase);
  const cohortName = link.cohortName ?? cohortDisplayNameFromNotionPage(page);
  const startDay = readNotionStartDayOfWeek(page);
  const notionColumns = await cohortNotionColumnsAvailable(supabase);

  const existingId = await findCohortForNotionImport(supabase, page, link.courseId, cohortName);
  let cohortId = existingId;

  let existingTutorSource: string | null = null;
  if (existingId) {
    const { data: existing } = await supabase
      .from("cohorts")
      .select("tutor_id_source")
      .eq("id", existingId)
      .maybeSingle();
    existingTutorSource = existing?.tutor_id_source ?? null;
  }

  const payload: Record<string, unknown> = {
    course_id: link.courseId,
    name: cohortName,
    status,
    start_date: page.startDate,
    end_date: page.endDate,
    start_day_of_week: startDay,
    active: true,
    ...cohortWeeklySessionPatchFromNotionPage(page),
  };
  const mappedTutorId = tutorIdFromNotionPackagePage(page, byNotionUserId);
  if (!isManualTutorSource(existingTutorSource)) {
    if (mappedTutorId !== undefined) {
      payload.tutor_id = mappedTutorId;
      payload.tutor_id_source = "notion";
    } else if (!existingId) {
      payload.tutor_id = null;
      payload.tutor_id_source = "notion";
    }
  }

  if (notionColumns) {
    payload.notion_page_id = page.pageId;
    payload.notion_sync_status = "synced";
    payload.notion_synced_at = new Date().toISOString();
    payload.notion_sync_error = null;
  }

  if (existingId) {
    const { error: updateError } = await supabase
      .from("cohorts")
      .update(payload)
      .eq("id", existingId);
    if (updateError) {
      return { ok: false, error: updateError.message };
    }
  } else {
    const { data: cohort, error: insertError } = await supabase
      .from("cohorts")
      .insert(payload)
      .select("id")
      .single();
    if (insertError || !cohort) {
      return { ok: false, error: insertError?.message ?? "Failed to create cohort." };
    }
    cohortId = cohort.id;
  }

  const rosterResult = await syncCohortRosterFromNotion(
    supabase,
    cohortId!,
    page.rawProperties,
    page.pageId
  );
  if (rosterResult.error) {
    return {
      ok: false,
      error: `Cohort saved but roster sync failed: ${rosterResult.error}`,
      cohortId: cohortId ?? undefined,
    };
  }

  await saveCohortNotionLink(supabase, page.pageId, cohortId!, {
    packageName: page.packageName,
    startDate: page.startDate,
    endDate: page.endDate,
    status: page.status,
    notionTutorUserId: page.notionTutorUserId,
    rawProperties: page.rawProperties,
  });

  return { ok: true, cohortId: cohortId! };
}

export async function autoLinkNotionPackagePage(
  supabase: SupabaseClient,
  page: ParsedNotionPackagePage
): Promise<
  | {
      ok: true;
      targetKind: "package_instance" | "cohort";
      targetId: string;
      link: { packageName: string; courseName: string };
    }
  | { ok: false; reason: string }
> {
  const catalog = await loadPackageCatalog(supabase);
  const resolved = resolveNotionSyncTargetFromPage(
    page,
    catalog.packages.filter((pkg) => (pkg as { active?: boolean }).active !== false),
    catalog.courses
  );

  if (!resolved.ok) {
    return { ok: false, reason: resolved.detail };
  }

  if (resolved.link.kind === "cohort") {
    const created = await createOrUpdateCohortFromNotionPage(supabase, page, resolved.link);
    if (!created.ok) {
      return { ok: false, reason: created.error ?? "Failed to create cohort." };
    }
    return {
      ok: true,
      targetKind: "cohort",
      targetId: created.cohortId!,
      link: {
        packageName: resolved.link.packageName,
        courseName: resolved.link.courseName,
      },
    };
  }

  const created = await createPackageInstanceFromNotionPage(
    supabase,
    page,
    resolved.link.packageId,
    resolved.link.courseId
  );

  if (!created.ok) {
    return { ok: false, reason: created.error ?? "Failed to create package instance." };
  }

  await supabase
    .from("notion_sync_inbox")
    .update({
      resolved: true,
      resolved_package_instance_id: created.instanceId,
      ...(await inboxCohortLinkColumnAvailable(supabase)
        ? { resolved_cohort_id: null }
        : {}),
    })
    .eq("notion_page_id", page.pageId);

  return {
    ok: true,
    targetKind: "package_instance",
    targetId: created.instanceId!,
    link: {
      packageName: resolved.link.packageName,
      courseName: resolved.link.courseName,
    },
  };
}

export async function autoLinkAllUnresolvedInbox(
  supabase: SupabaseClient
): Promise<{ linked: number; skipped: number; errors: string[] }> {
  const { data: rows, error } = await supabase
    .from("notion_sync_inbox")
    .select("*")
    .eq("resolved", false)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  let linked = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows ?? []) {
    const page = parsedNotionPackagePageFromInboxRow(row);

    const result = await autoLinkNotionPackagePage(supabase, page);
    if (result.ok) {
      if (result.targetKind === "package_instance") {
        const hasCohortCol = await inboxCohortLinkColumnAvailable(supabase);
        await supabase
          .from("notion_sync_inbox")
          .update({
            resolved: true,
            resolved_package_instance_id: result.targetId,
            ...(hasCohortCol ? { resolved_cohort_id: null } : {}),
          })
          .eq("id", row.id);
      }
      linked += 1;
      continue;
    }

    skipped += 1;
    errors.push(`${row.package_name ?? row.notion_page_id}: ${result.reason}`);
  }

  return { linked, skipped, errors };
}

function parsedNotionPackagePageFromInboxRow(row: {
  notion_page_id: string;
  created_at: string;
  package_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  notion_tutor_user_id: string | null;
  raw_properties: Record<string, unknown> | null;
}): ParsedNotionPackagePage {
  const raw = row.raw_properties ?? {};
  if (Object.keys(raw).length > 0) {
    const parsed = parseNotionPackagePage({
      id: row.notion_page_id,
      last_edited_time: row.created_at,
      properties: raw,
    });
    return {
      ...parsed,
      notionTutorUserId: row.notion_tutor_user_id ?? parsed.notionTutorUserId,
      status: (row.status as PackageInstanceStatus | null) ?? parsed.status,
    };
  }

  return {
    pageId: row.notion_page_id,
    lastEditedTime: row.created_at,
    packageName: row.package_name,
    startDate: normalizeCalendarDateFromIso(row.start_date),
    endDate: normalizeCalendarDateFromIso(row.end_date),
    status: (row.status as PackageInstanceStatus | null) ?? null,
    notionTutorUserId: row.notion_tutor_user_id,
    rawProperties: raw,
  };
}

export async function resyncAllNotionLinkedPackagesFromNotion(
  supabase: SupabaseClient
): Promise<{ updated: number; rosterSynced: number; errors: string[] }> {
  const [pages, cohortIdByNotionPageId] = await Promise.all([
    queryNotionPackagePagesEditedAfter(null),
    listNotionLinkedCohortIds(supabase),
  ]);

  let updated = 0;
  let rosterSynced = 0;
  const errors: string[] = [];
  const { byNotionUserId } = await loadNotionTutorMap(supabase);

  for (const page of pages) {
    const cohortId = cohortIdByNotionPageId.get(page.pageId);
    if (cohortId) {
      const { data: existingCohort } = await supabase
        .from("cohorts")
        .select("tutor_id_source")
        .eq("id", cohortId)
        .maybeSingle();

      const { error } = await supabase
        .from("cohorts")
        .update({
          ...omitTutorFromPullPatchIfManual(
            cohortPullPatchFromNotionPage(page, byNotionUserId),
            existingCohort?.tutor_id_source
          ),
          notion_sync_status: "synced",
          notion_synced_at: new Date().toISOString(),
          notion_sync_error: null,
        })
        .eq("id", cohortId);

      if (error) {
        errors.push(`${page.packageName ?? page.pageId}: cohort ${error.message}`);
        continue;
      }

      updated += 1;
      const rosterResult = await syncCohortRosterFromNotion(
        supabase,
        cohortId,
        page.rawProperties,
        page.pageId
      );
      if (rosterResult.error) {
        errors.push(`${page.packageName ?? page.pageId}: cohort roster ${rosterResult.error}`);
      } else {
        rosterSynced += rosterResult.synced;
      }

      await saveCohortNotionLink(supabase, page.pageId, cohortId, {
        packageName: page.packageName,
        startDate: page.startDate,
        endDate: page.endDate,
        status: page.status,
        notionTutorUserId: page.notionTutorUserId,
        rawProperties: page.rawProperties,
      });
      continue;
    }

    const { data: instance } = await supabase
      .from("package_instances")
      .select("id, tutor_id_source")
      .eq("notion_page_id", page.pageId)
      .maybeSingle();

    if (!instance) continue;

    const { error } = await supabase
      .from("package_instances")
      .update(
        omitTutorFromPullPatchIfManual(
          packageInstancePullPatchFromNotionPage(page, byNotionUserId),
          instance.tutor_id_source
        )
      )
      .eq("id", instance.id);

    if (error) {
      errors.push(`${page.packageName ?? page.pageId}: instance ${error.message}`);
      continue;
    }

    updated += 1;
    const rosterResult = await syncPackageInstanceRosterFromNotion(
      supabase,
      instance.id,
      page.rawProperties,
      page.pageId
    );
    if (rosterResult.error) {
      errors.push(`${page.packageName ?? page.pageId}: instance roster ${rosterResult.error}`);
    } else {
      rosterSynced += rosterResult.synced;
    }
  }

  return { updated, rosterSynced, errors };
}

/** Re-pull a linked cohort row and roster from its Notion package page. */
export async function refreshCohortFromNotionPage(
  supabase: SupabaseClient,
  cohortId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: cohort, error: loadError } = await supabase
    .from("cohorts")
    .select("id, notion_page_id, tutor_id_source")
    .eq("id", cohortId)
    .maybeSingle();

  if (loadError) return { ok: false, error: loadError.message };
  if (!cohort?.notion_page_id) {
    return { ok: false, error: "Cohort has no notion_page_id." };
  }

  const pageRaw = await notionJson<{
    id: string;
    last_edited_time: string;
    properties: Record<string, unknown>;
  }>(`/pages/${cohort.notion_page_id}`);

  const page = parseNotionPackagePage(pageRaw);
  const { byNotionUserId } = await loadNotionTutorMap(supabase);

  const patch: Record<string, unknown> = {
    ...omitTutorFromPullPatchIfManual(
      cohortPullPatchFromNotionPage(page, byNotionUserId),
      cohort.tutor_id_source
    ),
    notion_sync_status: "synced",
    notion_synced_at: new Date().toISOString(),
    notion_sync_error: null,
  };

  const { error: updateError } = await supabase.from("cohorts").update(patch).eq("id", cohortId);
  if (updateError) return { ok: false, error: updateError.message };

  const rosterResult = await syncCohortRosterFromNotion(
    supabase,
    cohortId,
    page.rawProperties,
    page.pageId
  );
  if (rosterResult.error) {
    return { ok: false, error: rosterResult.error };
  }

  await saveCohortNotionLink(supabase, page.pageId, cohortId, {
    packageName: page.packageName,
    startDate: page.startDate,
    endDate: page.endDate,
    status: page.status,
    notionTutorUserId: page.notionTutorUserId,
    rawProperties: page.rawProperties,
  });

  return { ok: true };
}

export async function linkInboxRowToPackageInstance(
  supabase: SupabaseClient,
  inboxId: string,
  packageId: string,
  courseId: string
): Promise<{ ok: boolean; error?: string; instanceId?: string }> {
  const { data: inbox, error: inboxError } = await supabase
    .from("notion_sync_inbox")
    .select("*")
    .eq("id", inboxId)
    .eq("resolved", false)
    .maybeSingle();

  if (inboxError || !inbox) {
    return { ok: false, error: inboxError?.message ?? "Inbox row not found." };
  }

  const page = parsedNotionPackagePageFromInboxRow(inbox);

  const created = await createPackageInstanceFromNotionPage(
    supabase,
    page,
    packageId,
    courseId
  );

  if (!created.ok) {
    return { ok: false, error: created.error ?? "Failed to create package instance." };
  }

  await supabase
    .from("notion_sync_inbox")
    .update({
      resolved: true,
      resolved_package_instance_id: created.instanceId,
    })
    .eq("id", inboxId);

  return { ok: true, instanceId: created.instanceId };
}
