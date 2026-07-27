import "server-only";

import {
  NOTION_LESSONS_LOG_DATA_SOURCE_ID,
  dateStart,
  notionJson,
  peopleIds,
  plainTextFromRichText,
  plainTextFromTitle,
  relationIds,
} from "@/lib/notion/client";
import { omitLessonLogManualFieldsFromPullPatch } from "@/lib/notion/lesson-log-field-source";
import type { SupabaseClient } from "@supabase/supabase-js";

type NotionQueryResponse = {
  results: Array<{
    id: string;
    last_edited_time: string;
    properties: Record<string, unknown>;
  }>;
  has_more: boolean;
  next_cursor: string | null;
};

export type ParsedLessonLogPage = {
  pageId: string;
  lastEditedTime: string;
  title: string | null;
  lessonDate: string | null;
  packageNotionPageId: string | null;
  recordingUrl: string | null;
  slidesUrl: string | null;
  flashcardsUrl: string | null;
  notes: string | null;
  notionTutorUserId: string | null;
  status: "Scheduled" | "Completed" | "Cancelled" | null;
  reviewed: boolean;
};

const LESSON_LOG_PULL_CURSOR_VIEW_TYPE = "notion_lesson_log_pull_cursor";
const LESSON_LOG_PULL_CURSOR_NAME = "cohort_lesson_log_entries";

const LESSON_LOG_STATUSES = new Set(["Scheduled", "Completed", "Cancelled"]);

function urlProp(value: { url?: string | null } | undefined): string | null {
  const url = value?.url?.trim();
  return url || null;
}

function selectName(
  value: { select?: { name?: string } | null } | undefined
): string | null {
  const name = value?.select?.name?.trim();
  return name || null;
}

function checkboxProp(value: { checkbox?: boolean } | undefined): boolean {
  return Boolean(value?.checkbox);
}

function parseLessonLogStatus(
  raw: string | null
): "Scheduled" | "Completed" | "Cancelled" | null {
  if (!raw) return null;
  return LESSON_LOG_STATUSES.has(raw)
    ? (raw as "Scheduled" | "Completed" | "Cancelled")
    : null;
}

function calendarDateOnly(isoOrDate: string | null): string | null {
  if (!isoOrDate?.trim()) return null;
  const trimmed = isoOrDate.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

export function parseNotionLessonLogPage(page: {
  id: string;
  last_edited_time: string;
  properties: Record<string, unknown>;
}): ParsedLessonLogPage {
  const props = page.properties;
  const packageIds = relationIds(
    props["New Package DB"] as { relation?: Array<{ id?: string }> }
  );
  const tutorIds = peopleIds(
    props["Actual Tutor (New)"] as { people?: Array<{ id?: string }> }
  );

  return {
    pageId: page.id,
    lastEditedTime: page.last_edited_time,
    title:
      plainTextFromTitle(props.Lesson as { title?: Array<{ plain_text?: string }> }) ||
      null,
    lessonDate: calendarDateOnly(
      dateStart(props["Lesson Date"] as { date?: { start?: string } | null })
    ),
    packageNotionPageId: packageIds[0] ?? null,
    recordingUrl: urlProp(props["Recording Link"] as { url?: string | null }),
    slidesUrl: urlProp(props.Slides as { url?: string | null }),
    flashcardsUrl: urlProp(props.Flashcards as { url?: string | null }),
    notes:
      plainTextFromRichText(props.notes as { rich_text?: Array<{ plain_text?: string }> }) ||
      null,
    notionTutorUserId: tutorIds[0] ?? null,
    status: parseLessonLogStatus(
      selectName(props.Status as { select?: { name?: string } | null })
    ),
    reviewed: checkboxProp(props.Reviewed as { checkbox?: boolean }),
  };
}

export async function queryNotionLessonLogPagesEditedAfter(
  editedAfter: string | null
): Promise<ParsedLessonLogPage[]> {
  const pages: ParsedLessonLogPage[] = [];
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
      `/databases/${NOTION_LESSONS_LOG_DATA_SOURCE_ID}/query`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    for (const result of data.results) {
      pages.push(parseNotionLessonLogPage(result));
    }

    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  return pages;
}

async function loadLessonLogPullCursor(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data } = await supabase
    .from("admin_saved_views")
    .select("config")
    .eq("view_type", LESSON_LOG_PULL_CURSOR_VIEW_TYPE)
    .eq("name", LESSON_LOG_PULL_CURSOR_NAME)
    .maybeSingle();

  const cursor = (data?.config as { lastEditedTime?: string } | null)?.lastEditedTime;
  if (!cursor?.trim()) return null;
  return new Date(new Date(cursor).getTime() - 3000).toISOString();
}

async function saveLessonLogPullCursor(
  supabase: SupabaseClient,
  lastEditedTime: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("admin_saved_views")
    .select("id")
    .eq("view_type", LESSON_LOG_PULL_CURSOR_VIEW_TYPE)
    .eq("name", LESSON_LOG_PULL_CURSOR_NAME)
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
    name: LESSON_LOG_PULL_CURSOR_NAME,
    view_type: LESSON_LOG_PULL_CURSOR_VIEW_TYPE,
    config: { lastEditedTime },
    created_by: createdBy,
  });
}

async function resolvePackageTarget(
  supabase: SupabaseClient,
  packageNotionPageId: string
): Promise<{ cohortId: string | null; packageInstanceId: string | null }> {
  const [{ data: cohort }, { data: instance }] = await Promise.all([
    supabase
      .from("cohorts")
      .select("id")
      .eq("notion_page_id", packageNotionPageId)
      .maybeSingle(),
    supabase
      .from("package_instances")
      .select("id")
      .eq("notion_page_id", packageNotionPageId)
      .maybeSingle(),
  ]);

  return {
    cohortId: cohort?.id ?? null,
    packageInstanceId: instance?.id ?? null,
  };
}

export async function upsertLessonLogEntryFromNotion(
  supabase: SupabaseClient,
  page: ParsedLessonLogPage
): Promise<"upserted" | "skipped"> {
  if (!page.lessonDate) {
    return "skipped";
  }

  let cohortId: string | null = null;
  let packageInstanceId: string | null = null;
  let syncStatus: "synced" | "error" = "synced";
  let syncError: string | null = null;

  if (!page.packageNotionPageId) {
    syncStatus = "error";
    syncError = "Notion lesson has no New Package DB relation.";
  } else {
    const target = await resolvePackageTarget(supabase, page.packageNotionPageId);
    cohortId = target.cohortId;
    packageInstanceId = target.packageInstanceId;
    if (!cohortId && !packageInstanceId) {
      syncStatus = "error";
      syncError = `Package Notion page ${page.packageNotionPageId} is not linked to a cohort or package instance.`;
    }
  }

  const { data: existing } = await supabase
    .from("cohort_lesson_log_entries")
    .select("id, source, status_source, reviewed_source, notes_source, status, dismissed_at")
    .eq("notion_page_id", page.pageId)
    .maybeSingle();

  const now = new Date().toISOString();
  const patch = omitLessonLogManualFieldsFromPullPatch(
    {
      notion_page_id: page.pageId,
      cohort_id: cohortId,
      package_instance_id: packageInstanceId,
      lesson_title: page.title,
      lesson_date: page.lessonDate,
      recording_url: page.recordingUrl,
      slides_url: page.slidesUrl,
      flashcards_url: page.flashcardsUrl,
      notes: page.notes,
      notes_source: "notion",
      notion_tutor_user_id: page.notionTutorUserId,
      notion_last_edited_at: page.lastEditedTime,
      status: page.status,
      status_source: "notion",
      reviewed: page.reviewed,
      reviewed_source: "notion",
      notion_sync_status: syncStatus,
      notion_sync_error: syncError,
      notion_synced_at: now,
      source: existing?.source === "app" ? "app" : "notion",
    },
    existing
  );

  // Effective status after manual locks — auto-dismiss Cancelled so it leaves the default list.
  const effectiveStatus =
    typeof patch.status !== "undefined"
      ? (patch.status as string | null)
      : ((existing?.status as string | null | undefined) ?? null);
  if (effectiveStatus === "Cancelled" && !existing?.dismissed_at) {
    patch.dismissed_at = now;
  } else if (
    typeof patch.status !== "undefined" &&
    patch.status !== "Cancelled" &&
    existing?.status === "Cancelled"
  ) {
    patch.dismissed_at = null;
    patch.dismissed_by = null;
  }

  if (existing?.id) {
    const { error } = await supabase
      .from("cohort_lesson_log_entries")
      .update(patch)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    if (effectiveStatus === "Cancelled") {
      patch.dismissed_at = now;
    }
    const { error } = await supabase.from("cohort_lesson_log_entries").insert(patch);
    if (error) throw new Error(error.message);
  }

  if (cohortId) {
    const { syncCohortLessonLogLessonIds } = await import(
      "@/lib/lessons/lesson-log-lesson-link"
    );
    await syncCohortLessonLogLessonIds(supabase, cohortId);
  }

  return "upserted";
}

export async function pullLessonLogFromNotion(
  supabase: SupabaseClient,
  options?: { fullSync?: boolean }
): Promise<{ pulled: number; skipped: number; errors: string[] }> {
  const cursor = options?.fullSync ? null : await loadLessonLogPullCursor(supabase);
  const pages = await queryNotionLessonLogPagesEditedAfter(cursor);
  let pulled = 0;
  let skipped = 0;
  const errors: string[] = [];
  let maxEdited = cursor;

  for (let i = 0; i < pages.length; i += 25) {
    const chunk = pages.slice(i, i + 25);
    const results = await Promise.all(
      chunk.map(async (page) => {
        try {
          const result = await upsertLessonLogEntryFromNotion(supabase, page);
          return { page, result, error: null as string | null };
        } catch (error) {
          return {
            page,
            result: "skipped" as const,
            error: `${page.pageId}: ${error instanceof Error ? error.message : "upsert failed"}`,
          };
        }
      })
    );

    for (const item of results) {
      if (item.error) errors.push(item.error);
      else if (item.result === "upserted") pulled += 1;
      else skipped += 1;
      if (!maxEdited || item.page.lastEditedTime > maxEdited) {
        maxEdited = item.page.lastEditedTime;
      }
    }
  }

  if (maxEdited && maxEdited !== cursor) {
    await saveLessonLogPullCursor(supabase, maxEdited);
  }

  return { pulled, skipped, errors };
}

export type CreateLessonLogInput = {
  cohortId?: string | null;
  packageInstanceId?: string | null;
  lessonDate: string;
  notes?: string | null;
  recordingUrl?: string | null;
  slidesUrl?: string | null;
  flashcardsUrl?: string | null;
  status?: "Scheduled" | "Completed" | "Cancelled" | null;
  loggedBy?: string | null;
  notionTutorUserId?: string | null;
};

async function resolvePackageNotionPageId(
  supabase: SupabaseClient,
  input: { cohortId?: string | null; packageInstanceId?: string | null }
): Promise<
  | {
      ok: true;
      cohortId: string | null;
      packageInstanceId: string | null;
      name: string;
      packageNotionPageId: string;
    }
  | { ok: false; error: string }
> {
  if (input.cohortId) {
    const { data: cohort, error } = await supabase
      .from("cohorts")
      .select("id, name, notion_page_id")
      .eq("id", input.cohortId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!cohort?.notion_page_id) {
      return { ok: false, error: "This cohort is not linked to Notion yet." };
    }
    return {
      ok: true,
      cohortId: cohort.id,
      packageInstanceId: null,
      name: cohort.name,
      packageNotionPageId: cohort.notion_page_id,
    };
  }

  if (input.packageInstanceId) {
    const { data: instance, error } = await supabase
      .from("package_instances")
      .select("id, name, notion_page_id")
      .eq("id", input.packageInstanceId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!instance?.notion_page_id) {
      return { ok: false, error: "This package instance is not linked to Notion yet." };
    }
    return {
      ok: true,
      cohortId: null,
      packageInstanceId: instance.id,
      name: instance.name?.trim() || "1-1 package",
      packageNotionPageId: instance.notion_page_id,
    };
  }

  return { ok: false, error: "Choose a cohort or package instance." };
}

export async function createLessonLogInNotionAndSupabase(
  supabase: SupabaseClient,
  input: CreateLessonLogInput
): Promise<{ ok: true; entryId: string; notionPageId: string } | { ok: false; error: string }> {
  const lessonDate = calendarDateOnly(input.lessonDate);
  if (!lessonDate) {
    return { ok: false, error: "Lesson date is required." };
  }

  const target = await resolvePackageNotionPageId(supabase, input);
  if (!target.ok) return target;

  const status = input.status ?? "Completed";
  const title = `${target.name}  - ${lessonDate} `;
  const properties: Record<string, unknown> = {
    Lesson: {
      title: [{ type: "text", text: { content: title.slice(0, 2000) } }],
    },
    "Lesson Date": {
      date: { start: lessonDate },
    },
    "New Package DB": {
      relation: [{ id: target.packageNotionPageId }],
    },
    Status: { select: { name: status } },
    Reviewed: { checkbox: false },
  };

  if (input.notes?.trim()) {
    properties.notes = {
      rich_text: [{ type: "text", text: { content: input.notes.trim().slice(0, 2000) } }],
    };
  }
  if (input.recordingUrl?.trim()) {
    properties["Recording Link"] = { url: input.recordingUrl.trim() };
  }
  if (input.slidesUrl?.trim()) {
    properties.Slides = { url: input.slidesUrl.trim() };
  }
  if (input.flashcardsUrl?.trim()) {
    properties.Flashcards = { url: input.flashcardsUrl.trim() };
  }
  if (input.notionTutorUserId?.trim()) {
    properties["Actual Tutor (New)"] = {
      people: [{ id: input.notionTutorUserId.trim() }],
    };
  }

  let notionPageId: string;
  try {
    const created = await notionJson<{ id: string }>("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: NOTION_LESSONS_LOG_DATA_SOURCE_ID },
        properties,
      }),
    });
    notionPageId = created.id;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to create Notion Lessons Log page.",
    };
  }

  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await supabase
    .from("cohort_lesson_log_entries")
    .insert({
      notion_page_id: notionPageId,
      cohort_id: target.cohortId,
      package_instance_id: target.packageInstanceId,
      lesson_title: title.trim(),
      lesson_date: lessonDate,
      recording_url: input.recordingUrl?.trim() || null,
      slides_url: input.slidesUrl?.trim() || null,
      flashcards_url: input.flashcardsUrl?.trim() || null,
      notes: input.notes?.trim() || null,
      notes_source: "notion",
      notion_tutor_user_id: input.notionTutorUserId?.trim() || null,
      logged_by: input.loggedBy?.trim() || null,
      source: "app",
      status,
      status_source: "notion",
      reviewed: false,
      reviewed_source: "notion",
      notion_sync_status: "synced",
      notion_sync_error: null,
      notion_synced_at: now,
      notion_last_edited_at: now,
      ...(status === "Cancelled"
        ? { dismissed_at: now, dismissed_by: input.loggedBy?.trim() || null }
        : {}),
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      error:
        insertError?.message ??
        "Notion page was created, but saving the local log row failed. It should appear after the next sync.",
    };
  }

  if (target.cohortId) {
    const { syncCohortLessonLogLessonIds } = await import(
      "@/lib/lessons/lesson-log-lesson-link"
    );
    await syncCohortLessonLogLessonIds(supabase, target.cohortId);
  }

  return { ok: true, entryId: inserted.id, notionPageId };
}

export type UpdateLessonLogManualFieldsInput = {
  status?: "Scheduled" | "Completed" | "Cancelled" | null;
  reviewed?: boolean;
  notes?: string | null;
  recordingUrl?: string | null;
  /** When status becomes Cancelled, set dismissed_at/dismissed_by so it leaves the default list. */
  dismissedBy?: string | null;
};

/**
 * Admin edits that lock fields (mirrors setting tutor_id_source = 'manual').
 * Does not push back to Notion — Supabase-only override until reset.
 */
export async function updateLessonLogManualFields(
  supabase: SupabaseClient,
  entryId: string,
  fields: UpdateLessonLogManualFieldsInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const patch: Record<string, unknown> = {};

  if (fields.status !== undefined) {
    patch.status = fields.status;
    patch.status_source = "manual";
    if (fields.status === "Cancelled") {
      patch.dismissed_at = new Date().toISOString();
      patch.dismissed_by = fields.dismissedBy ?? null;
    } else {
      // Re-opening a cancelled lesson brings it back into the default list.
      patch.dismissed_at = null;
      patch.dismissed_by = null;
    }
  }
  if (fields.reviewed !== undefined) {
    patch.reviewed = fields.reviewed;
    patch.reviewed_source = "manual";
  }
  if (fields.notes !== undefined) {
    patch.notes = fields.notes?.trim() || null;
    patch.notes_source = "manual";
  }
  if (fields.recordingUrl !== undefined) {
    patch.recording_url = fields.recordingUrl?.trim() || null;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "No fields to update." };
  }

  const { data: entryRow } = await supabase
    .from("cohort_lesson_log_entries")
    .select("cohort_id")
    .eq("id", entryId)
    .maybeSingle();

  const { error } = await supabase
    .from("cohort_lesson_log_entries")
    .update(patch)
    .eq("id", entryId);

  if (error) return { ok: false, error: error.message };

  if (entryRow?.cohort_id) {
    const { syncCohortLessonLogLessonIds } = await import(
      "@/lib/lessons/lesson-log-lesson-link"
    );
    await syncCohortLessonLogLessonIds(supabase, entryRow.cohort_id);
  }

  return { ok: true };
}

/** One-shot / on-load: Cancelled rows without dismissed_at get dismissed so they leave the default list. */
export async function backfillCancelledLessonLogDismissals(
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase
    .from("cohort_lesson_log_entries")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("status", "Cancelled")
    .is("dismissed_at", null);

  if (error && !error.message.includes("dismissed_at")) {
    console.error("backfillCancelledLessonLogDismissals:", error.message);
  }
}

/**
 * Reset locked fields from the linked Notion page (mirrors resetPackageTutorToNotion).
 */
export async function resetLessonLogFieldsToNotion(
  supabase: SupabaseClient,
  entryId: string,
  fields: Array<"status" | "reviewed" | "notes">
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (fields.length === 0) return { ok: false, error: "Choose a field to reset." };

  const { data: entry, error: loadError } = await supabase
    .from("cohort_lesson_log_entries")
    .select("id, notion_page_id")
    .eq("id", entryId)
    .maybeSingle();

  if (loadError) return { ok: false, error: loadError.message };
  if (!entry?.notion_page_id) {
    return { ok: false, error: "This entry is not linked to a Notion page." };
  }

  let page: ParsedLessonLogPage;
  try {
    const raw = await notionJson<{
      id: string;
      last_edited_time: string;
      properties: Record<string, unknown>;
    }>(`/pages/${entry.notion_page_id}`);
    page = parseNotionLessonLogPage(raw);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to load Notion page.",
    };
  }

  const patch: Record<string, unknown> = {};
  if (fields.includes("status")) {
    patch.status = page.status;
    patch.status_source = "notion";
  }
  if (fields.includes("reviewed")) {
    patch.reviewed = page.reviewed;
    patch.reviewed_source = "notion";
  }
  if (fields.includes("notes")) {
    patch.notes = page.notes;
    patch.notes_source = "notion";
  }

  const { error } = await supabase
    .from("cohort_lesson_log_entries")
    .update(patch)
    .eq("id", entryId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
