import type { PackageInstanceStatus } from "@/lib/admin/package-status";
import {
  NOTION_PACKAGE_DATA_SOURCE_ID,
  dateStart,
  notionJson,
  peopleIds,
  plainTextFromTitle,
  selectName,
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
      select: { name: notionStatusFromDb(row.status) },
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

  return {
    pageId: page.id,
    lastEditedTime: page.last_edited_time,
    packageName:
      plainTextFromTitle(
        props["Package Name"] as { title?: Array<{ plain_text?: string }> }
      ) || null,
    startDate: dateStart(props["Start Date"] as { date?: { start?: string } | null }),
    endDate: dateStart(props["End Date"] as { date?: { start?: string } | null }),
    status: dbStatusFromNotion(selectName(props.Status as { select?: { name?: string } | null })),
    notionTutorUserId: tutorIds[0] ?? null,
    rawProperties: page.properties,
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

    await supabase
      .from("package_instances")
      .update({
        notion_page_id: pageId,
        notion_sync_status: "synced",
        notion_synced_at: new Date().toISOString(),
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
  return cursor?.trim() || null;
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
  skipped: number;
  errors: string[];
}> {
  const cursor = await loadPackagePullCursor(supabase);
  const pages = await queryNotionPackagePagesEditedAfter(cursor);
  let pulled = 0;
  let inboxed = 0;
  let skipped = 0;
  const errors: string[] = [];
  let maxEdited = cursor;

  const { byNotionUserId } = await loadNotionTutorMap(supabase);

  for (const page of pages) {
    if (!maxEdited || page.lastEditedTime > maxEdited) {
      maxEdited = page.lastEditedTime;
    }

    const { data: existing } = await supabase
      .from("package_instances")
      .select("id, notion_synced_at")
      .eq("notion_page_id", page.pageId)
      .maybeSingle();

    if (existing) {
      const notionSyncedAt = existing.notion_synced_at
        ? new Date(existing.notion_synced_at).getTime()
        : 0;
      const notionEditedAt = new Date(page.lastEditedTime).getTime();

      if (notionEditedAt <= notionSyncedAt) {
        skipped += 1;
        continue;
      }

      const patch: Record<string, unknown> = {};
      if (page.packageName) patch.name = page.packageName;
      if (page.startDate !== null) patch.start_date = page.startDate;
      if (page.endDate !== null) patch.end_date = page.endDate;
      if (page.status) patch.status = page.status;
      if (page.notionTutorUserId) {
        const mapped = byNotionUserId.get(page.notionTutorUserId);
        patch.tutor_id = mapped?.tutorId ?? null;
      } else {
        patch.tutor_id = null;
      }

      const { error } = await supabase
        .from("package_instances")
        .update({
          ...patch,
          notion_sync_status: "synced",
          notion_synced_at: new Date().toISOString(),
          notion_sync_error: null,
        })
        .eq("id", existing.id);

      if (error) {
        errors.push(`${page.pageId}: ${error.message}`);
      } else {
        pulled += 1;
      }
      continue;
    }

    const { error: inboxError } = await supabase.from("notion_sync_inbox").upsert(
      {
        notion_page_id: page.pageId,
        package_name: page.packageName,
        start_date: page.startDate,
        end_date: page.endDate,
        status: page.status,
        notion_tutor_user_id: page.notionTutorUserId,
        raw_properties: page.rawProperties,
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

  return { pulled, inboxed, skipped, errors };
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

  const status = (inbox.status as PackageInstanceStatus | null) ?? "pre_scheduling";
  const { byNotionUserId } = await loadNotionTutorMap(supabase);

  const { data: instance, error: insertError } = await supabase
    .from("package_instances")
    .insert({
      package_id: packageId,
      course_id: courseId,
      name: inbox.package_name?.trim() || "Imported from Notion",
      status,
      start_date: inbox.start_date,
      end_date: inbox.end_date,
      tutor_id: inbox.notion_tutor_user_id
        ? byNotionUserId.get(inbox.notion_tutor_user_id)?.tutorId ?? null
        : null,
      notion_page_id: inbox.notion_page_id,
      notion_sync_status: "synced",
      notion_synced_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !instance) {
    return { ok: false, error: insertError?.message ?? "Failed to create package instance." };
  }

  await supabase
    .from("notion_sync_inbox")
    .update({
      resolved: true,
      resolved_package_instance_id: instance.id,
    })
    .eq("id", inboxId);

  return { ok: true, instanceId: instance.id };
}
