import type { SupabaseClient } from "@supabase/supabase-js";
import { NotionApiError, notionJson } from "@/lib/notion/client";

const NOTION_DATA_SOURCE_VERSION = "2025-09-03";
const PACKAGE_CONCURRENCY = 2;

export const REQUIRED_LESSON_PROPERTIES: Record<string, string> = {
  "Session Title": "title",
  Date: "date",
  Recording: "url",
  Presentation: "url",
  Flashcards: "url",
};

export type SkippedPackageLessonSource = {
  kind: "cohort" | "package_instance";
  id: string;
  name: string;
  notionPageId: string;
  reason: string;
};

export type PackageLessonRecordingSyncResult = {
  packagesScanned: number;
  rowsRead: number;
  linksFilled: number;
  unmatchedRows: number;
  skipped: SkippedPackageLessonSource[];
  errors: string[];
};

type PackageTarget = {
  kind: "cohort" | "package_instance";
  id: string;
  name: string;
  notionPageId: string;
  dataSourceId: string | null;
};

type LogEntryRecording = {
  id: string;
  lessonDate: string;
  recordingUrl: string | null;
};

type NotionBlock = {
  id: string;
  type: string;
};

type NotionProperty = { type?: string };

type NotionPage = {
  properties?: Record<string, unknown>;
};

const dataSourceHeaders = { "Notion-Version": NOTION_DATA_SOURCE_VERSION };

export function lessonDateFromNotionDate(start: string | null | undefined): string | null {
  const value = start?.trim() ?? "";
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(parsed);
}

export function assessPackageLessonStructure(input: {
  childPageCount: number;
  inlineDatabasesOnPage: number;
  inlineDatabaseCount: number;
  dataSourceCount: number;
  properties: Record<string, string | undefined>;
}): { ok: true } | { ok: false; reason: string } {
  if (input.childPageCount === 0) {
    return {
      ok: false,
      reason:
        input.inlineDatabasesOnPage > 0
          ? "no child page (inline database is on the package page)"
          : "no child page",
    };
  }
  if (input.childPageCount > 1) {
    return { ok: false, reason: `several child pages (${input.childPageCount})` };
  }
  if (input.inlineDatabaseCount === 0) {
    return { ok: false, reason: "no inline database" };
  }
  if (input.inlineDatabaseCount > 1) {
    return { ok: false, reason: `several inline databases (${input.inlineDatabaseCount})` };
  }
  if (input.dataSourceCount === 0) {
    return { ok: false, reason: "no data source" };
  }
  if (input.dataSourceCount > 1) {
    return { ok: false, reason: `several data sources (${input.dataSourceCount})` };
  }

  const problems: string[] = [];
  for (const [name, type] of Object.entries(REQUIRED_LESSON_PROPERTIES)) {
    const actual = input.properties[name];
    if (actual !== type) {
      problems.push(`${name} (${actual ?? "missing"}, expected ${type})`);
    }
  }
  if (problems.length > 0) {
    const found = Object.entries(input.properties)
      .map(([name, type]) => `${name} (${type ?? "unknown"})`)
      .join(", ");
    return {
      ok: false,
      reason: `different property names: ${problems.join("; ")}; found ${found || "none"}`,
    };
  }
  return { ok: true };
}

export function planRecordingLinkFill(
  entries: LogEntryRecording[],
  lessonDate: string | null,
  recordingUrl: string
): { action: "fill"; entryId: string } | { action: "already_set" } | { action: "unmatched" } {
  const url = recordingUrl.trim();
  if (!url || !lessonDate) return { action: "unmatched" };
  const matches = entries.filter((entry) => entry.lessonDate.slice(0, 10) === lessonDate);
  if (matches.length !== 1) return { action: "unmatched" };
  if ((matches[0].recordingUrl ?? "").trim()) return { action: "already_set" };
  return { action: "fill", entryId: matches[0].id };
}

function emptyResult(): PackageLessonRecordingSyncResult {
  return {
    packagesScanned: 0,
    rowsRead: 0,
    linksFilled: 0,
    unmatchedRows: 0,
    skipped: [],
    errors: [],
  };
}

function addResult(
  total: PackageLessonRecordingSyncResult,
  part: PackageLessonRecordingSyncResult
) {
  total.packagesScanned += part.packagesScanned;
  total.rowsRead += part.rowsRead;
  total.linksFilled += part.linksFilled;
  total.unmatchedRows += part.unmatchedRows;
  total.skipped.push(...part.skipped);
  total.errors.push(...part.errors);
}

function normalizeDataSourceId(value: string | null | undefined): string | null {
  const trimmed = value?.trim().replace(/^collection:\/\//, "") ?? "";
  return trimmed || null;
}

function notionMessage(error: unknown): string {
  if (error instanceof NotionApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Notion request failed.";
}

async function listBlockChildren(blockId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | null = null;
  do {
    const path: string = `/blocks/${blockId}/children?page_size=100${
      cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ""
    }`;
    const data: {
      results: NotionBlock[];
      has_more: boolean;
      next_cursor: string | null;
    } = await notionJson(path);
    blocks.push(...(data.results ?? []));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return blocks;
}

function propertyTypes(properties: Record<string, NotionProperty> | undefined) {
  const types: Record<string, string | undefined> = {};
  for (const [name, spec] of Object.entries(properties ?? {})) {
    types[name] = spec?.type;
  }
  return types;
}

async function discoverDataSourceId(notionPageId: string): Promise<
  { ok: true; dataSourceId: string } | { ok: false; reason: string }
> {
  const children = await listBlockChildren(notionPageId);
  const childPages = children.filter((block) => block.type === "child_page");
  const databasesOnPage = children.filter((block) => block.type === "child_database");
  if (childPages.length !== 1) {
    const assessed = assessPackageLessonStructure({
      childPageCount: childPages.length,
      inlineDatabasesOnPage: databasesOnPage.length,
      inlineDatabaseCount: 0,
      dataSourceCount: 0,
      properties: {},
    });
    return assessed.ok ? { ok: false, reason: "no child page" } : assessed;
  }

  const inner = await listBlockChildren(childPages[0].id);
  const databases = inner.filter((block) => block.type === "child_database");
  if (databases.length !== 1) {
    const assessed = assessPackageLessonStructure({
      childPageCount: 1,
      inlineDatabasesOnPage: databasesOnPage.length,
      inlineDatabaseCount: databases.length,
      dataSourceCount: 0,
      properties: {},
    });
    return assessed.ok ? { ok: false, reason: "no inline database" } : assessed;
  }

  const database = await notionJson<{ data_sources?: Array<{ id?: string }> }>(
    `/databases/${databases[0].id}`,
    { headers: dataSourceHeaders }
  );
  const sources = (database.data_sources ?? []).filter((source) => source.id);
  if (sources.length !== 1) {
    const assessed = assessPackageLessonStructure({
      childPageCount: 1,
      inlineDatabasesOnPage: 0,
      inlineDatabaseCount: 1,
      dataSourceCount: sources.length,
      properties: {},
    });
    return assessed.ok ? { ok: false, reason: "no data source" } : assessed;
  }

  const dataSourceId = sources[0].id as string;
  const schema = await notionJson<{ properties?: Record<string, NotionProperty> }>(
    `/data_sources/${dataSourceId}`,
    { headers: dataSourceHeaders }
  );
  const assessed = assessPackageLessonStructure({
    childPageCount: 1,
    inlineDatabasesOnPage: 0,
    inlineDatabaseCount: 1,
    dataSourceCount: 1,
    properties: propertyTypes(schema.properties),
  });
  if (!assessed.ok) return assessed;
  return { ok: true, dataSourceId };
}

function readRecording(properties: Record<string, unknown> | undefined): string {
  const recording = properties?.Recording as { type?: string; url?: string | null } | undefined;
  if (recording?.type && recording.type !== "url") return "";
  return typeof recording?.url === "string" ? recording.url.trim() : "";
}

function readDate(properties: Record<string, unknown> | undefined): string | null {
  const date = properties?.Date as { date?: { start?: string | null } | null } | undefined;
  return lessonDateFromNotionDate(date?.date?.start);
}

async function queryLessonRows(
  dataSourceId: string
): Promise<{ ok: true; rows: NotionPage[] } | { ok: false; stale: boolean; reason: string }> {
  try {
    const rows: NotionPage[] = [];
    let cursor: string | null = null;
    do {
      const body: Record<string, unknown> = { page_size: 100 };
      if (cursor) body.start_cursor = cursor;
      const data = await notionJson<{
        results: NotionPage[];
        has_more: boolean;
        next_cursor: string | null;
      }>(`/data_sources/${dataSourceId}/query`, {
        method: "POST",
        headers: dataSourceHeaders,
        body: JSON.stringify(body),
      });
      rows.push(...(data.results ?? []));
      cursor = data.has_more ? data.next_cursor : null;
    } while (cursor);

    const missingRecording = rows.some((row) => !("Recording" in (row.properties ?? {})));
    if (missingRecording) {
      return { ok: false, stale: true, reason: "different property names: Recording missing on a row" };
    }
    return { ok: true, rows };
  } catch (error) {
    const stale = error instanceof NotionApiError && (error.status === 404 || error.status === 400);
    return { ok: false, stale, reason: notionMessage(error) };
  }
}

async function loadTargets(supabase: SupabaseClient): Promise<PackageTarget[]> {
  const [cohorts, instances] = await Promise.all([
    supabase
      .from("cohorts")
      .select("id, name, notion_page_id, notion_lessons_data_source_id")
      .eq("active", true)
      .not("notion_page_id", "is", null),
    supabase
      .from("package_instances")
      .select("id, name, notion_page_id, notion_lessons_data_source_id")
      .eq("active", true)
      .not("notion_page_id", "is", null),
  ]);

  if (cohorts.error) throw new Error(cohorts.error.message);
  if (instances.error) throw new Error(instances.error.message);

  const targets: PackageTarget[] = [];
  for (const row of cohorts.data ?? []) {
    const notionPageId = String(row.notion_page_id ?? "").trim();
    if (!notionPageId) continue;
    targets.push({
      kind: "cohort",
      id: row.id,
      name: row.name ?? "Cohort",
      notionPageId,
      dataSourceId: normalizeDataSourceId(row.notion_lessons_data_source_id),
    });
  }
  for (const row of instances.data ?? []) {
    const notionPageId = String(row.notion_page_id ?? "").trim();
    if (!notionPageId) continue;
    targets.push({
      kind: "package_instance",
      id: row.id,
      name: row.name ?? "Package",
      notionPageId,
      dataSourceId: normalizeDataSourceId(row.notion_lessons_data_source_id),
    });
  }
  return targets;
}

function tableFor(kind: PackageTarget["kind"]): "cohorts" | "package_instances" {
  return kind === "cohort" ? "cohorts" : "package_instances";
}

async function cacheDataSourceId(
  supabase: SupabaseClient,
  target: PackageTarget,
  dataSourceId: string | null
) {
  const { error } = await supabase
    .from(tableFor(target.kind))
    .update({ notion_lessons_data_source_id: dataSourceId })
    .eq("id", target.id);
  if (error) throw new Error(error.message);
}

async function loadLogEntries(
  supabase: SupabaseClient,
  target: PackageTarget
): Promise<LogEntryRecording[]> {
  const column = target.kind === "cohort" ? "cohort_id" : "package_instance_id";
  const { data, error } = await supabase
    .from("cohort_lesson_log_entries")
    .select("id, lesson_date, recording_url")
    .eq(column, target.id);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    lessonDate: String(row.lesson_date ?? ""),
    recordingUrl: (row.recording_url as string | null) ?? null,
  }));
}

async function fillRecordingUrl(
  supabase: SupabaseClient,
  entryId: string,
  url: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("cohort_lesson_log_entries")
    .update({ recording_url: url })
    .eq("id", entryId)
    .or('recording_url.is.null,recording_url.eq.""')
    .select("id");
  if (error) throw new Error(error.message);
  if ((data ?? []).length > 0) return true;

  const { data: again, error: readError } = await supabase
    .from("cohort_lesson_log_entries")
    .select("recording_url")
    .eq("id", entryId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (String(again?.recording_url ?? "").trim()) return false;

  const { error: blankError } = await supabase
    .from("cohort_lesson_log_entries")
    .update({ recording_url: url })
    .eq("id", entryId);
  if (blankError) throw new Error(blankError.message);
  return true;
}

async function applyRows(
  supabase: SupabaseClient,
  target: PackageTarget,
  rows: NotionPage[]
): Promise<PackageLessonRecordingSyncResult> {
  const result = emptyResult();
  result.packagesScanned = 1;
  result.rowsRead = rows.length;
  const entries = await loadLogEntries(supabase, target);

  for (const row of rows) {
    const recordingUrl = readRecording(row.properties);
    if (!recordingUrl) continue;
    const lessonDate = readDate(row.properties);
    const plan = planRecordingLinkFill(entries, lessonDate, recordingUrl);
    if (plan.action === "unmatched") {
      result.unmatchedRows += 1;
      continue;
    }
    if (plan.action === "already_set") continue;

    const filled = await fillRecordingUrl(supabase, plan.entryId, recordingUrl);
    if (!filled) continue;
    result.linksFilled += 1;
    const entry = entries.find((item) => item.id === plan.entryId);
    if (entry) entry.recordingUrl = recordingUrl;
  }

  return result;
}

async function syncTarget(
  supabase: SupabaseClient,
  target: PackageTarget
): Promise<PackageLessonRecordingSyncResult> {
  const skipped = (reason: string): PackageLessonRecordingSyncResult => ({
    packagesScanned: 1,
    rowsRead: 0,
    linksFilled: 0,
    unmatchedRows: 0,
    skipped: [
      {
        kind: target.kind,
        id: target.id,
        name: target.name,
        notionPageId: target.notionPageId,
        reason,
      },
    ],
    errors: [],
  });

  try {
    let dataSourceId = target.dataSourceId;
    if (dataSourceId) {
      const queried = await queryLessonRows(dataSourceId);
      if (queried.ok) return applyRows(supabase, target, queried.rows);
      if (!queried.stale) return skipped(queried.reason);
      await cacheDataSourceId(supabase, target, null);
      dataSourceId = null;
    }

    const discovered = await discoverDataSourceId(target.notionPageId);
    if (!discovered.ok) return skipped(discovered.reason);
    await cacheDataSourceId(supabase, target, discovered.dataSourceId);
    const queried = await queryLessonRows(discovered.dataSourceId);
    if (!queried.ok) return skipped(queried.reason);
    return applyRows(supabase, target, queried.rows);
  } catch (error) {
    return skipped(notionMessage(error));
  }
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function syncPackageLessonRecordings(
  supabase: SupabaseClient
): Promise<PackageLessonRecordingSyncResult> {
  const targets = await loadTargets(supabase);
  let done = 0;
  const parts = await mapPool(targets, PACKAGE_CONCURRENCY, async (target) => {
    const part = await syncTarget(supabase, target);
    done += 1;
    if (done % 25 === 0 || done === targets.length) {
      console.log(`[package-lesson-recordings] ${done}/${targets.length}`);
    }
    return part;
  });
  const total = emptyResult();
  for (const part of parts) addResult(total, part);
  return total;
}
