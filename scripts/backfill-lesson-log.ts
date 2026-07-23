/**
 * One-off full backfill of Notion Lessons Log → cohort_lesson_log_entries.
 * Usage: npx tsx --env-file=.env.local scripts/backfill-lesson-log.ts
 */
import { createClient } from "@supabase/supabase-js";

const NOTION_API_VERSION = "2022-06-28";
const NOTION_LESSONS_LOG_DATA_SOURCE_ID =
  process.env.NOTION_LESSONS_LOG_DATA_SOURCE_ID ?? "2b0b5ac4-29c6-80b1-ad5e-d3f15d15e6c3";
const COHORT_30_ID = "7b828044-d62d-4e07-98bc-5d52c0b3cc1b";

function getNotionKey(): string {
  const key = process.env.NOTION_API_KEY?.trim();
  if (!key) throw new Error("NOTION_API_KEY is not set.");
  return key;
}

async function notionJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getNotionKey()}`,
      "Notion-Version": NOTION_API_VERSION,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Notion API ${response.status}: ${body.slice(0, 400)}`);
  }
  return JSON.parse(body) as T;
}

function plainTextFromTitle(
  value: { title?: Array<{ plain_text?: string }> } | undefined
): string {
  return (value?.title ?? []).map((part) => part.plain_text ?? "").join("").trim();
}

function plainTextFromRichText(
  value: { rich_text?: Array<{ plain_text?: string }> } | undefined
): string {
  return (value?.rich_text ?? []).map((part) => part.plain_text ?? "").join("").trim();
}

function relationIds(value: { relation?: Array<{ id?: string }> } | undefined): string[] {
  return (value?.relation ?? [])
    .map((entry) => entry.id?.trim())
    .filter((id): id is string => Boolean(id));
}

function peopleIds(value: { people?: Array<{ id?: string }> } | undefined): string[] {
  return (value?.people ?? [])
    .map((person) => person.id?.trim())
    .filter((id): id is string => Boolean(id));
}

function calendarDateOnly(isoOrDate: string | null): string | null {
  if (!isoOrDate?.trim()) return null;
  const trimmed = isoOrDate.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return trimmed.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
}

type ParsedPage = {
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
};

function parsePage(page: {
  id: string;
  last_edited_time: string;
  properties: Record<string, unknown>;
}): ParsedPage {
  const props = page.properties;
  return {
    pageId: page.id,
    lastEditedTime: page.last_edited_time,
    title: plainTextFromTitle(props.Lesson as { title?: Array<{ plain_text?: string }> }) || null,
    lessonDate: calendarDateOnly(
      (props["Lesson Date"] as { date?: { start?: string } | null } | undefined)?.date?.start ??
        null
    ),
    packageNotionPageId:
      relationIds(props["New Package DB"] as { relation?: Array<{ id?: string }> })[0] ?? null,
    recordingUrl:
      (props["Recording Link"] as { url?: string | null } | undefined)?.url?.trim() || null,
    slidesUrl: (props.Slides as { url?: string | null } | undefined)?.url?.trim() || null,
    flashcardsUrl: (props.Flashcards as { url?: string | null } | undefined)?.url?.trim() || null,
    notes:
      plainTextFromRichText(props.notes as { rich_text?: Array<{ plain_text?: string }> }) || null,
    notionTutorUserId:
      peopleIds(props["Actual Tutor (New)"] as { people?: Array<{ id?: string }> })[0] ?? null,
  };
}

async function queryAllPages(): Promise<ParsedPage[]> {
  const pages: ParsedPage[] = [];
  let cursor: string | null = null;
  do {
    const body: Record<string, unknown> = {
      page_size: 100,
      sorts: [{ timestamp: "last_edited_time", direction: "ascending" }],
    };
    if (cursor) body.start_cursor = cursor;
    const data = await notionJson<{
      results: Array<{
        id: string;
        last_edited_time: string;
        properties: Record<string, unknown>;
      }>;
      has_more: boolean;
      next_cursor: string | null;
    }>(`/databases/${NOTION_LESSONS_LOG_DATA_SOURCE_ID}/query`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    for (const result of data.results) pages.push(parsePage(result));
    cursor = data.has_more ? data.next_cursor : null;
    process.stdout.write(`\rFetched ${pages.length} Notion pages…`);
  } while (cursor);
  process.stdout.write("\n");
  return pages;
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const t0 = Date.now();
  const pages = await queryAllPages();
  console.log(`Upserting ${pages.length} pages…`);

  let pulled = 0;
  let skipped = 0;
  const errors: string[] = [];
  const cohortCache = new Map<string, string | null>();
  const instanceCache = new Map<string, string | null>();

  async function resolveTarget(packageNotionPageId: string) {
    if (!cohortCache.has(packageNotionPageId)) {
      const { data } = await supabase
        .from("cohorts")
        .select("id")
        .eq("notion_page_id", packageNotionPageId)
        .maybeSingle();
      cohortCache.set(packageNotionPageId, data?.id ?? null);
    }
    if (!instanceCache.has(packageNotionPageId)) {
      const { data } = await supabase
        .from("package_instances")
        .select("id")
        .eq("notion_page_id", packageNotionPageId)
        .maybeSingle();
      instanceCache.set(packageNotionPageId, data?.id ?? null);
    }
    return {
      cohortId: cohortCache.get(packageNotionPageId) ?? null,
      packageInstanceId: instanceCache.get(packageNotionPageId) ?? null,
    };
  }

  for (let i = 0; i < pages.length; i += 25) {
    const chunk = pages.slice(i, i + 25);
    await Promise.all(
      chunk.map(async (page) => {
        try {
          if (!page.lessonDate || !page.packageNotionPageId) {
            skipped += 1;
            return;
          }
          const target = await resolveTarget(page.packageNotionPageId);
          if (!target.cohortId && !target.packageInstanceId) {
            skipped += 1;
            return;
          }
          const { error } = await supabase.from("cohort_lesson_log_entries").upsert(
            {
              notion_page_id: page.pageId,
              cohort_id: target.cohortId,
              package_instance_id: target.packageInstanceId,
              lesson_title: page.title,
              lesson_date: page.lessonDate,
              recording_url: page.recordingUrl,
              slides_url: page.slidesUrl,
              flashcards_url: page.flashcardsUrl,
              notes: page.notes,
              notion_tutor_user_id: page.notionTutorUserId,
              notion_last_edited_at: page.lastEditedTime,
              source: "notion",
            },
            { onConflict: "notion_page_id" }
          );
          if (error) throw new Error(error.message);
          pulled += 1;
        } catch (error) {
          errors.push(
            `${page.pageId}: ${error instanceof Error ? error.message : "upsert failed"}`
          );
        }
      })
    );
    process.stdout.write(`\rUpserted ${Math.min(i + 25, pages.length)}/${pages.length}…`);
  }
  process.stdout.write("\n");

  const { count: total, error: totalErr } = await supabase
    .from("cohort_lesson_log_entries")
    .select("id", { count: "exact", head: true });
  if (totalErr) throw totalErr;

  const { data: c30, error: c30Err } = await supabase
    .from("cohort_lesson_log_entries")
    .select("lesson_date, lesson_title")
    .eq("cohort_id", COHORT_30_ID)
    .order("lesson_date", { ascending: true });
  if (c30Err) throw c30Err;

  console.log(
    JSON.stringify(
      {
        notion_pages_fetched: pages.length,
        pulled,
        skipped,
        errors: errors.length,
        error_sample: errors.slice(0, 5),
        elapsed_ms: Date.now() - t0,
        total_rows: total,
        cohort_30_count: c30?.length ?? 0,
        cohort_30_dates: (c30 ?? []).map((row) => row.lesson_date),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
