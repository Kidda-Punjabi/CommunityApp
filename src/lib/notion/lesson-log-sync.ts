import "server-only";

import {
  NOTION_LESSONS_LOG_DATA_SOURCE_ID,
  NotionApiError,
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
    .select(
      "id, source, status_source, reviewed_source, notes_source, status, dismissed_at, recording_url"
    )
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

  // Never wipe a local recording with an empty Notion Recording Link.
  const existingRecording =
    typeof existing?.recording_url === "string" ? existing.recording_url.trim() : "";
  const notionRecording = page.recordingUrl?.trim() || "";
  if (!notionRecording && existingRecording) {
    delete patch.recording_url;
  }

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

type LessonLogPackageTarget = Extract<
  Awaited<ReturnType<typeof resolvePackageNotionPageId>>,
  { ok: true }
>;

type ExistingCohortLessonLogRow = {
  id: string;
  notion_page_id: string;
  lesson_title: string | null;
  source: string | null;
  status_source: string | null;
  notes_source: string | null;
  status: string | null;
  notes: string | null;
  recording_url: string | null;
  slides_url: string | null;
  flashcards_url: string | null;
  logged_by: string | null;
  notion_tutor_user_id: string | null;
  dismissed_at: string | null;
};

type LessonLogWriteResult =
  | { ok: true; entryId: string; notionPageId: string }
  | { ok: false; error: string };

const lessonLogWriteTails = new Map<string, Promise<unknown>>();

async function withLessonLogWriteLock<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = lessonLogWriteTails.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(work);
  lessonLogWriteTails.set(key, run);
  try {
    return await run;
  } finally {
    if (lessonLogWriteTails.get(key) === run) {
      lessonLogWriteTails.delete(key);
    }
  }
}

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  const message = error.message ?? "";
  return (
    message.includes("cohort_lesson_log_entries_cohort_date_unique") ||
    message.toLowerCase().includes("duplicate key")
  );
}

function isMissingNotionPage(error: unknown): boolean {
  if (!(error instanceof NotionApiError)) return false;
  if (error.status === 404) return true;
  return error.status === 400 && /could not find page|page not found/i.test(error.body);
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

async function findExistingCohortLessonLogEntry(
  supabase: SupabaseClient,
  cohortId: string,
  lessonDate: string
): Promise<ExistingCohortLessonLogRow | null> {
  const { data, error } = await supabase
    .from("cohort_lesson_log_entries")
    .select(
      "id, notion_page_id, lesson_title, source, status_source, notes_source, status, notes, recording_url, slides_url, flashcards_url, logged_by, notion_tutor_user_id, dismissed_at"
    )
    .eq("cohort_id", cohortId)
    .eq("lesson_date", lessonDate)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ExistingCohortLessonLogRow | null) ?? null;
}

function buildLessonLogNotionProperties(options: {
  title?: string | null;
  lessonDate: string;
  packageNotionPageId: string;
  status?: string | null;
  includeReviewed?: boolean;
  notes?: string | null;
  recordingUrl?: string | null;
  slidesUrl?: string | null;
  flashcardsUrl?: string | null;
  notionTutorUserId?: string | null;
}): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    "Lesson Date": { date: { start: options.lessonDate } },
    "New Package DB": { relation: [{ id: options.packageNotionPageId }] },
  };
  if (options.title?.trim()) {
    properties.Lesson = {
      title: [{ type: "text", text: { content: options.title.trim().slice(0, 2000) } }],
    };
  }
  if (options.status) {
    properties.Status = { select: { name: options.status } };
  }
  if (options.includeReviewed) {
    properties.Reviewed = { checkbox: false };
  }
  if (options.notes?.trim()) {
    properties.notes = {
      rich_text: [{ type: "text", text: { content: options.notes.trim().slice(0, 2000) } }],
    };
  }
  if (options.recordingUrl?.trim()) {
    properties["Recording Link"] = { url: options.recordingUrl.trim() };
  }
  if (options.slidesUrl?.trim()) {
    properties.Slides = { url: options.slidesUrl.trim() };
  }
  if (options.flashcardsUrl?.trim()) {
    properties.Flashcards = { url: options.flashcardsUrl.trim() };
  }
  if (options.notionTutorUserId?.trim()) {
    properties["Actual Tutor (New)"] = {
      people: [{ id: options.notionTutorUserId.trim() }],
    };
  }
  return properties;
}

async function createLessonLogNotionPage(properties: Record<string, unknown>): Promise<string> {
  const created = await notionJson<{ id: string }>("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: NOTION_LESSONS_LOG_DATA_SOURCE_ID },
      properties,
    }),
  });
  return created.id;
}

async function patchLessonLogNotionPage(
  pageId: string,
  properties: Record<string, unknown>
): Promise<void> {
  await notionJson(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ archived: false, properties }),
  });
}

async function archiveLessonLogNotionPage(pageId: string): Promise<void> {
  try {
    await notionJson(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
    });
  } catch {
    // Best-effort: local row is the source of truth after a create race.
  }
}

async function pushLessonLogToExistingNotionPage(
  existing: ExistingCohortLessonLogRow,
  patchProperties: Record<string, unknown>,
  createProperties: Record<string, unknown>
): Promise<string> {
  try {
    await patchLessonLogNotionPage(existing.notion_page_id, patchProperties);
    return existing.notion_page_id;
  } catch (error) {
    if (!isMissingNotionPage(error)) throw error;
    return createLessonLogNotionPage(createProperties);
  }
}

function buildLessonLogRowPayload(options: {
  input: CreateLessonLogInput;
  existing: ExistingCohortLessonLogRow | null;
  notionPageId: string;
  cohortId: string | null;
  packageInstanceId: string | null;
  title: string;
  lessonDate: string;
  status: "Scheduled" | "Completed" | "Cancelled";
}): Record<string, unknown> {
  const { input, existing } = options;
  const now = new Date().toISOString();
  const notes = firstNonEmpty(input.notes, existing?.notes);
  const recordingUrl = firstNonEmpty(input.recordingUrl, existing?.recording_url);
  const slidesUrl = firstNonEmpty(input.slidesUrl, existing?.slides_url);
  const flashcardsUrl = firstNonEmpty(input.flashcardsUrl, existing?.flashcards_url);
  const loggedBy = firstNonEmpty(input.loggedBy, existing?.logged_by);
  const notionTutorUserId = firstNonEmpty(input.notionTutorUserId, existing?.notion_tutor_user_id);
  const statusLocked = existing?.status_source === "manual";
  const notesLocked = existing?.notes_source === "manual";
  const status = statusLocked
    ? ((existing?.status as typeof options.status | null) ?? options.status)
    : options.status;

  const payload: Record<string, unknown> = {
    notion_page_id: options.notionPageId,
    cohort_id: options.cohortId,
    package_instance_id: options.packageInstanceId,
    lesson_date: options.lessonDate,
    recording_url: recordingUrl,
    slides_url: slidesUrl,
    flashcards_url: flashcardsUrl,
    logged_by: loggedBy,
    notion_tutor_user_id: notionTutorUserId,
    notion_sync_status: "synced",
    notion_sync_error: null,
    notion_synced_at: now,
    notion_last_edited_at: now,
  };

  if (!existing) {
    payload.lesson_title = options.title.trim();
    payload.source = "app";
    payload.reviewed = false;
    payload.reviewed_source = "notion";
  }

  if (!statusLocked) {
    payload.status = status;
    payload.status_source = "notion";
  }
  if (!notesLocked) {
    payload.notes = notes;
    if (!existing || input.notes?.trim()) {
      payload.notes_source = "notion";
    }
  }

  const effectiveStatus =
    (payload.status as string | undefined) ?? existing?.status ?? null;
  if (effectiveStatus === "Cancelled") {
    payload.dismissed_at = existing?.dismissed_at ?? now;
    payload.dismissed_by = loggedBy;
  } else if (existing?.status === "Cancelled") {
    payload.dismissed_at = null;
    payload.dismissed_by = null;
  }

  return payload;
}

async function runLessonLogPostSaveSideEffects(
  supabase: SupabaseClient,
  options: { cohortId: string | null; entryId: string; loggedBy: string | null }
): Promise<void> {
  if (!options.cohortId) return;

  const { syncCohortLessonLogLessonIds } = await import(
    "@/lib/lessons/lesson-log-lesson-link"
  );
  await syncCohortLessonLogLessonIds(supabase, options.cohortId);

  const { data: linked } = await supabase
    .from("cohort_lesson_log_entries")
    .select("lesson_id, recording_url")
    .eq("id", options.entryId)
    .maybeSingle();

  if (linked?.lesson_id && linked.recording_url) {
    const { syncCohortLessonRecordingFromLog } = await import(
      "@/lib/tutoring/sync-cohort-recording-from-log"
    );
    await syncCohortLessonRecordingFromLog(supabase, {
      cohortId: options.cohortId,
      lessonId: linked.lesson_id,
      recordingUrl: linked.recording_url,
      uploadedBy: options.loggedBy,
    });
  }

  const { maybeAutoUnlockAfterLessonLog } = await import(
    "@/lib/lessons/cohort-lesson-unlock"
  );
  await maybeAutoUnlockAfterLessonLog(supabase, {
    cohortId: options.cohortId,
    entryId: options.entryId,
    unlockedBy: options.loggedBy,
  });
}

async function insertCohortLessonLogEntry(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
): Promise<
  | { ok: true; id: string }
  | { ok: false; conflict: true }
  | { ok: false; conflict: false; error: string }
> {
  // INSERT ... ON CONFLICT (cohort_id, lesson_date) DO UPDATE cannot go through
  // PostgREST upsert: that would overwrite notion_page_id with a racing create.
  // After cohort_lesson_log_entries_cohort_date_unique exists, a racing INSERT
  // returns 23505 and the caller merges onto the existing row instead.
  const inserted = await supabase
    .from("cohort_lesson_log_entries")
    .insert(payload)
    .select("id")
    .single();

  if (!inserted.error && inserted.data?.id) {
    return { ok: true, id: inserted.data.id as string };
  }
  if (isUniqueViolation(inserted.error)) {
    return { ok: false, conflict: true };
  }
  return {
    ok: false,
    conflict: false,
    error:
      inserted.error?.message ??
      "Notion page was created, but saving the local log row failed. It should appear after the next sync.",
  };
}

async function updateExistingLessonLogFromApp(options: {
  supabase: SupabaseClient;
  input: CreateLessonLogInput;
  target: LessonLogPackageTarget;
  existing: ExistingCohortLessonLogRow;
  lessonDate: string;
  status: "Scheduled" | "Completed" | "Cancelled";
  title: string;
}): Promise<LessonLogWriteResult> {
  const { supabase, input, target, existing, lessonDate, status, title } = options;
  const statusLocked = existing.status_source === "manual";
  const notesLocked = existing.notes_source === "manual";
  const patchProperties = buildLessonLogNotionProperties({
    lessonDate,
    packageNotionPageId: target.packageNotionPageId,
    status: statusLocked ? null : status,
    notes: notesLocked ? null : input.notes,
    recordingUrl: input.recordingUrl,
    slidesUrl: input.slidesUrl,
    flashcardsUrl: input.flashcardsUrl,
    notionTutorUserId: input.notionTutorUserId,
  });
  const createProperties = buildLessonLogNotionProperties({
    title: existing.lesson_title?.trim() || title,
    lessonDate,
    packageNotionPageId: target.packageNotionPageId,
    status: statusLocked ? existing.status : status,
    includeReviewed: true,
    notes: notesLocked ? existing.notes : firstNonEmpty(input.notes, existing.notes),
    recordingUrl: firstNonEmpty(input.recordingUrl, existing.recording_url),
    slidesUrl: firstNonEmpty(input.slidesUrl, existing.slides_url),
    flashcardsUrl: firstNonEmpty(input.flashcardsUrl, existing.flashcards_url),
    notionTutorUserId: firstNonEmpty(input.notionTutorUserId, existing.notion_tutor_user_id),
  });

  let notionPageId: string;
  try {
    notionPageId = await pushLessonLogToExistingNotionPage(
      existing,
      patchProperties,
      createProperties
    );
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to update Notion Lessons Log page.",
    };
  }

  const payload = buildLessonLogRowPayload({
    input,
    existing,
    notionPageId,
    cohortId: target.cohortId,
    packageInstanceId: target.packageInstanceId,
    title,
    lessonDate,
    status,
  });

  const { error } = await supabase
    .from("cohort_lesson_log_entries")
    .update(payload)
    .eq("id", existing.id);
  if (error) return { ok: false, error: error.message };

  await runLessonLogPostSaveSideEffects(supabase, {
    cohortId: target.cohortId,
    entryId: existing.id,
    loggedBy: firstNonEmpty(input.loggedBy, existing.logged_by),
  });

  return { ok: true, entryId: existing.id, notionPageId };
}

async function createOrUpdateLessonLogInNotionAndSupabase(
  supabase: SupabaseClient,
  input: CreateLessonLogInput,
  target: LessonLogPackageTarget,
  lessonDate: string
): Promise<LessonLogWriteResult> {
  const status = input.status ?? "Completed";
  const title = `${target.name}  - ${lessonDate} `;
  let existing: ExistingCohortLessonLogRow | null = null;
  if (target.cohortId) {
    try {
      existing = await findExistingCohortLessonLogEntry(
        supabase,
        target.cohortId,
        lessonDate
      );
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to look up existing lesson log.",
      };
    }
  }

  if (existing) {
    return updateExistingLessonLogFromApp({
      supabase,
      input,
      target,
      existing,
      lessonDate,
      status,
      title,
    });
  }

  const properties = buildLessonLogNotionProperties({
    title,
    lessonDate,
    packageNotionPageId: target.packageNotionPageId,
    status,
    includeReviewed: true,
    notes: input.notes,
    recordingUrl: input.recordingUrl,
    slidesUrl: input.slidesUrl,
    flashcardsUrl: input.flashcardsUrl,
    notionTutorUserId: input.notionTutorUserId,
  });

  let notionPageId: string;
  try {
    notionPageId = await createLessonLogNotionPage(properties);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to create Notion Lessons Log page.",
    };
  }

  const payload = buildLessonLogRowPayload({
    input,
    existing: null,
    notionPageId,
    cohortId: target.cohortId,
    packageInstanceId: target.packageInstanceId,
    title,
    lessonDate,
    status,
  });

  const inserted = await insertCohortLessonLogEntry(supabase, payload);
  if (!inserted.ok) {
    if (inserted.conflict && target.cohortId) {
      await archiveLessonLogNotionPage(notionPageId);
      const winner = await findExistingCohortLessonLogEntry(
        supabase,
        target.cohortId,
        lessonDate
      );
      if (!winner) {
        return {
          ok: false,
          error:
            "A lesson log for this cohort and date already exists, but it could not be loaded.",
        };
      }
      return updateExistingLessonLogFromApp({
        supabase,
        input,
        target,
        existing: winner,
        lessonDate,
        status,
        title,
      });
    }
    if (inserted.conflict) {
      return {
        ok: false,
        error: "A lesson log for this date already exists.",
      };
    }
    return { ok: false, error: inserted.error };
  }

  await runLessonLogPostSaveSideEffects(supabase, {
    cohortId: target.cohortId,
    entryId: inserted.id,
    loggedBy: input.loggedBy?.trim() || null,
  });

  return { ok: true, entryId: inserted.id, notionPageId };
}

export async function createLessonLogInNotionAndSupabase(
  supabase: SupabaseClient,
  input: CreateLessonLogInput
): Promise<LessonLogWriteResult> {
  const lessonDate = calendarDateOnly(input.lessonDate);
  if (!lessonDate) {
    return { ok: false, error: "Lesson date is required." };
  }

  const target = await resolvePackageNotionPageId(supabase, input);
  if (!target.ok) return target;

  const lockKey = target.cohortId
    ? `cohort:${target.cohortId}:${lessonDate}`
    : `instance:${target.packageInstanceId}:${lessonDate}`;

  return withLessonLogWriteLock(lockKey, () =>
    createOrUpdateLessonLogInNotionAndSupabase(supabase, input, target, lessonDate)
  );
}

export type UpdateLessonLogManualFieldsInput = {
  status?: "Scheduled" | "Completed" | "Cancelled" | null;
  reviewed?: boolean;
  notes?: string | null;
  recordingUrl?: string | null;
  /** When status becomes Cancelled, set dismissed_at/dismissed_by so it leaves the default list. */
  dismissedBy?: string | null;
  /** Actor for student-facing lesson_recordings.uploaded_by when syncing a recording. */
  uploadedBy?: string | null;
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
    .select("cohort_id, lesson_id")
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

    if (fields.recordingUrl !== undefined) {
      const { data: linked } = await supabase
        .from("cohort_lesson_log_entries")
        .select("cohort_id, lesson_id, recording_url")
        .eq("id", entryId)
        .maybeSingle();

      if (linked?.cohort_id && linked.lesson_id) {
        const { syncCohortLessonRecordingFromLog } = await import(
          "@/lib/tutoring/sync-cohort-recording-from-log"
        );
        await syncCohortLessonRecordingFromLog(supabase, {
          cohortId: linked.cohort_id,
          lessonId: linked.lesson_id,
          recordingUrl: linked.recording_url,
          uploadedBy: fields.uploadedBy ?? fields.dismissedBy ?? null,
        });
      }
    }
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
