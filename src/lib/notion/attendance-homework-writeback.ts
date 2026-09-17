import "server-only";

import {
  NOTION_LEADS_DATA_SOURCE_ID,
  NOTION_LESSONS_LOG_DATA_SOURCE_ID,
  notionJson,
  relationIds,
} from "@/lib/notion/client";
import {
  LEADS_APP_USER_ID_PROPERTY,
  LEADS_KID_PROFILE_ID_PROPERTY,
  WRITEBACK_BATCH_SIZE,
  WRITEBACK_MAX_ATTEMPTS,
  classifyLookupCount,
  mergeRelationIds,
  relationPropertyForKind,
  shouldRetryFailed,
  uniqueNotionIds,
  type WritebackKind,
} from "@/lib/notion/attendance-homework-writeback-logic";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AttendanceHomeworkWritebackResult = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  createdLessonLogPages: number;
  errors: string[];
};

type QueueRow = {
  id: string;
  kind: WritebackKind;
  student_id: string | null;
  kid_profile_id: string | null;
  cohort_id: string | null;
  lesson_id: string;
  lesson_date: string | null;
  source_row_id: string;
  status: string;
  attempts: number;
  last_error: string | null;
};

type SkipReason =
  | "no matching lead page"
  | "ambiguous lead pages"
  | "cohort package page not resolved"
  | "ambiguous lessons log pages"
  | "no lesson date"
  | "no matching cohort";

class WritebackSkip extends Error {
  constructor(readonly reason: SkipReason) {
    super(reason);
    this.name = "WritebackSkip";
  }
}

type NotionPageProperty = {
  id?: string;
  type?: string;
  relation?: Array<{ id?: string }>;
  has_more?: boolean;
};

type NotionQueryResponse = {
  results: Array<{ id: string }>;
  has_more: boolean;
  next_cursor: string | null;
};

function calendarDateOnly(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

async function queryLeadPageIds(property: string, value: string): Promise<string[]> {
  const id = value.trim();
  if (!id) return [];

  const data = await notionJson<NotionQueryResponse>(
    `/databases/${NOTION_LEADS_DATA_SOURCE_ID}/query`,
    {
      method: "POST",
      body: JSON.stringify({
        filter: {
          property,
          rich_text: { equals: id },
        },
        page_size: 5,
      }),
    }
  );

  return uniqueNotionIds(
    (data.results ?? []).map((row) => row.id).filter((pageId): pageId is string => Boolean(pageId))
  );
}

async function resolveLeadPageId(row: QueueRow): Promise<string> {
  if (row.kid_profile_id) {
    const ids = await queryLeadPageIds(LEADS_KID_PROFILE_ID_PROPERTY, row.kid_profile_id);
    const count = classifyLookupCount(ids);
    if (count === "none") throw new WritebackSkip("no matching lead page");
    if (count === "many") throw new WritebackSkip("ambiguous lead pages");
    return ids[0]!;
  }

  const studentId = row.student_id?.trim() ?? "";
  if (!studentId) throw new WritebackSkip("no matching lead page");

  const ids = await queryLeadPageIds(LEADS_APP_USER_ID_PROPERTY, studentId);
  const count = classifyLookupCount(ids);
  if (count === "none") throw new WritebackSkip("no matching lead page");
  if (count === "many") throw new WritebackSkip("ambiguous lead pages");
  return ids[0]!;
}

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.map((id) => id?.trim()).filter((id): id is string => Boolean(id)))];
}

async function resolveHomeworkCohortId(
  supabase: SupabaseClient,
  row: QueueRow
): Promise<string | null> {
  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("course_id")
    .eq("id", row.lesson_id)
    .maybeSingle();
  if (lessonError) throw lessonError;
  const courseId = (lesson?.course_id as string | null)?.trim() ?? "";
  if (!courseId) return null;

  let enrollmentQuery = supabase
    .from("course_enrollments")
    .select("cohort_id")
    .eq("course_id", courseId)
    .not("cohort_id", "is", null);
  enrollmentQuery = row.kid_profile_id
    ? enrollmentQuery.eq("kid_profile_id", row.kid_profile_id)
    : enrollmentQuery.eq("user_id", row.student_id ?? "");

  const { data: enrollments, error: enrollmentError } = await enrollmentQuery;
  if (enrollmentError) throw enrollmentError;
  const enrollmentIds = uniqueIds((enrollments ?? []).map((item) => item.cohort_id as string | null));
  if (enrollmentIds.length === 1) return enrollmentIds[0]!;
  if (enrollmentIds.length > 1) return null;

  let memberQuery = supabase
    .from("cohort_members")
    .select("cohort_id, cohorts!inner(course_id)")
    .eq("cohorts.course_id", courseId)
    .is("left_at", null);
  memberQuery = row.kid_profile_id
    ? memberQuery.eq("kid_profile_id", row.kid_profile_id)
    : memberQuery.eq("user_id", row.student_id ?? "");

  const { data: members, error: memberError } = await memberQuery;
  if (memberError) throw memberError;
  const memberIds = uniqueIds((members ?? []).map((item) => item.cohort_id as string | null));
  return memberIds.length === 1 ? memberIds[0]! : null;
}

async function resolveLessonDate(
  supabase: SupabaseClient,
  cohortId: string,
  lessonId: string
): Promise<string | null> {
  const { data: logRows, error: logError } = await supabase
    .from("cohort_lesson_log_entries")
    .select("lesson_date")
    .eq("cohort_id", cohortId)
    .eq("lesson_id", lessonId)
    .not("lesson_date", "is", null);
  if (logError) throw logError;
  const logDates = [
    ...new Set(
      (logRows ?? [])
        .map((row) => calendarDateOnly(row.lesson_date as string | null))
        .filter((value): value is string => Boolean(value))
    ),
  ];
  if (logDates.length === 1) return logDates[0]!;
  if (logDates.length > 1) return null;

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("lesson_number")
    .eq("id", lessonId)
    .maybeSingle();
  if (lessonError) throw lessonError;
  const lessonNumber = Number(lesson?.lesson_number);
  if (!Number.isFinite(lessonNumber) || lessonNumber < 1) return null;

  const { data: sessions, error: sessionError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("starts_at, match_method, status")
    .eq("cohort_id", cohortId)
    .eq("week_number", lessonNumber)
    .eq("status", "scheduled");
  if (sessionError) throw sessionError;

  const sessionDates = [
    ...new Set(
      (sessions ?? [])
        .filter((session) => {
          const method = session.match_method as string | null;
          return method !== "unmatched" && method !== "title_name";
        })
        .map((session) => {
          const startsAt = session.starts_at as string | null;
          if (!startsAt) return null;
          return new Intl.DateTimeFormat("en-CA", {
            timeZone: "Europe/London",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(startsAt));
        })
        .filter((value): value is string => Boolean(value))
    ),
  ];
  return sessionDates.length === 1 ? sessionDates[0]! : null;
}

async function resolveCohortAndDate(
  supabase: SupabaseClient,
  row: QueueRow
): Promise<{ cohortId: string; lessonDate: string; packageNotionPageId: string }> {
  let cohortId = row.cohort_id?.trim() || null;
  if (!cohortId) {
    cohortId = await resolveHomeworkCohortId(supabase, row);
  }
  if (!cohortId) throw new WritebackSkip("no matching cohort");

  const { data: cohort, error: cohortError } = await supabase
    .from("cohorts")
    .select("id, notion_page_id")
    .eq("id", cohortId)
    .maybeSingle();
  if (cohortError) throw cohortError;

  const packageNotionPageId = cohort?.notion_page_id?.trim() ?? "";
  if (!packageNotionPageId) throw new WritebackSkip("cohort package page not resolved");

  let lessonDate = calendarDateOnly(row.lesson_date);
  if (!lessonDate) {
    lessonDate = await resolveLessonDate(supabase, cohortId, row.lesson_id);
  }
  if (!lessonDate) throw new WritebackSkip("no lesson date");

  return { cohortId, lessonDate, packageNotionPageId };
}

async function findLessonLogPagesForPackageDate(
  packageNotionPageId: string,
  lessonDate: string
): Promise<string[]> {
  const data = await notionJson<NotionQueryResponse>(
    `/databases/${NOTION_LESSONS_LOG_DATA_SOURCE_ID}/query`,
    {
      method: "POST",
      body: JSON.stringify({
        page_size: 5,
        filter: {
          and: [
            { property: "Lesson Date", date: { equals: lessonDate } },
            {
              property: "New Package DB",
              relation: { contains: packageNotionPageId },
            },
          ],
        },
      }),
    }
  );

  return uniqueNotionIds(
    (data.results ?? []).map((row) => row.id).filter((pageId): pageId is string => Boolean(pageId))
  );
}

async function createCompletedLessonLogPage(
  packageNotionPageId: string,
  lessonDate: string
): Promise<string> {
  const created = await notionJson<{ id: string }>("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: NOTION_LESSONS_LOG_DATA_SOURCE_ID },
      properties: {
        "New Package DB": { relation: [{ id: packageNotionPageId }] },
        "Lesson Date": { date: { start: lessonDate } },
        Status: { select: { name: "Completed" } },
      },
    }),
  });
  return created.id;
}

async function resolveLessonLogPageId(
  packageNotionPageId: string,
  lessonDate: string
): Promise<{ pageId: string; created: boolean }> {
  const existing = await findLessonLogPagesForPackageDate(packageNotionPageId, lessonDate);
  const count = classifyLookupCount(existing);
  if (count === "many") throw new WritebackSkip("ambiguous lessons log pages");
  if (count === "one") return { pageId: existing[0]!, created: false };

  const pageId = await createCompletedLessonLogPage(packageNotionPageId, lessonDate);
  return { pageId, created: true };
}

async function readAllRelationIds(pageId: string, propertyName: string): Promise<string[]> {
  const page = await notionJson<{ properties: Record<string, NotionPageProperty> }>(
    `/pages/${pageId}`
  );
  const prop = page.properties[propertyName];
  if (!prop || prop.type !== "relation") return [];

  if (!prop.has_more || !prop.id) {
    return uniqueNotionIds(relationIds(prop));
  }

  const ids: string[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ page_size: "100" });
    if (cursor) query.set("start_cursor", cursor);
    const data = await notionJson<{
      results?: Array<{ relation?: { id?: string } }>;
      has_more: boolean;
      next_cursor: string | null;
    }>(`/pages/${pageId}/properties/${prop.id}?${query.toString()}`);

    for (const item of data.results ?? []) {
      const id = item.relation?.id?.trim();
      if (id) ids.push(id);
    }
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  return uniqueNotionIds(ids);
}

async function appendLeadToRelation(
  notionPageId: string,
  propertyName: string,
  leadPageId: string
): Promise<void> {
  const existing = await readAllRelationIds(notionPageId, propertyName);
  const merged = mergeRelationIds(existing, leadPageId);
  if (!merged.changed) return;

  await notionJson(`/pages/${notionPageId}`, {
    method: "PATCH",
    body: JSON.stringify({
      archived: false,
      properties: {
        [propertyName]: {
          relation: merged.next.map((id) => ({ id })),
        },
      },
    }),
  });
}

async function markQueueRow(
  supabase: SupabaseClient,
  id: string,
  patch: {
    status: "sent" | "failed" | "skipped";
    last_error: string | null;
    attempts?: number;
  }
): Promise<void> {
  const { error } = await supabase
    .from("notion_lesson_writeback_queue")
    .update({
      status: patch.status,
      last_error: patch.last_error,
      processed_at: new Date().toISOString(),
      ...(patch.attempts != null ? { attempts: patch.attempts } : {}),
    })
    .eq("id", id);
  if (error) {
    console.error("[notion-sync] writeback queue update failed:", error.message);
  }
}

async function processQueueRow(
  supabase: SupabaseClient,
  row: QueueRow
): Promise<{ createdLessonLogPage: boolean }> {
  const leadPageId = await resolveLeadPageId(row);
  const { lessonDate, packageNotionPageId } = await resolveCohortAndDate(supabase, row);
  const lessonLog = await resolveLessonLogPageId(packageNotionPageId, lessonDate);
  await appendLeadToRelation(
    lessonLog.pageId,
    relationPropertyForKind(row.kind),
    leadPageId
  );
  return { createdLessonLogPage: lessonLog.created };
}

export async function processAttendanceHomeworkWriteback(
  supabase: SupabaseClient,
  options?: { batchSize?: number }
): Promise<AttendanceHomeworkWritebackResult> {
  const batchSize = options?.batchSize ?? WRITEBACK_BATCH_SIZE;
  const result: AttendanceHomeworkWritebackResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    createdLessonLogPages: 0,
    errors: [],
  };

  const { data, error } = await supabase
    .from("notion_lesson_writeback_queue")
    .select(
      "id, kind, student_id, kid_profile_id, cohort_id, lesson_id, lesson_date, source_row_id, status, attempts, last_error"
    )
    .or(`status.eq.pending,and(status.eq.failed,attempts.lt.${WRITEBACK_MAX_ATTEMPTS})`)
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (error) {
    if (error.message.includes("notion_lesson_writeback_queue")) {
      return result;
    }
    result.errors.push(error.message);
    return result;
  }

  const rows = (data ?? []) as QueueRow[];
  for (const row of rows) {
    if (row.status === "failed" && !shouldRetryFailed(row.attempts)) continue;
    result.processed += 1;
    try {
      const outcome = await processQueueRow(supabase, row);
      if (outcome.createdLessonLogPage) result.createdLessonLogPages += 1;
      await markQueueRow(supabase, row.id, { status: "sent", last_error: null });
      result.sent += 1;
    } catch (error) {
      if (error instanceof WritebackSkip) {
        await markQueueRow(supabase, row.id, {
          status: "skipped",
          last_error: error.reason,
        });
        result.skipped += 1;
        if (
          error.reason === "ambiguous lead pages" ||
          error.reason === "ambiguous lessons log pages" ||
          error.reason === "cohort package page not resolved"
        ) {
          result.errors.push(`${row.id}: ${error.reason}`);
        }
        continue;
      }

      const message = error instanceof Error ? error.message : String(error);
      const attempts = row.attempts + 1;
      await markQueueRow(supabase, row.id, {
        status: "failed",
        last_error: message.slice(0, 1000),
        attempts,
      });
      result.failed += 1;
      result.errors.push(`${row.id}: ${message}`);
    }
  }

  return result;
}
