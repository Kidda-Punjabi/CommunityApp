/**
 * Copy Notion "Cover Session?" and "Actual Tutor (New)" onto existing lesson logs.
 *
 *   node --import tsx scripts/backfill-cover-lesson-logs.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { NOTION_LESSONS_LOG_DATA_SOURCE_ID, notionJson } from "../src/lib/notion/client";

type NotionPage = {
  id: string;
  properties: Record<string, {
    title?: Array<{ plain_text?: string }>;
    date?: { start?: string | null } | null;
    people?: Array<{ id?: string }>;
    checkbox?: boolean;
  }>;
};

function titleOf(page: NotionPage): string | null {
  const text = (page.properties.Lesson?.title ?? [])
    .map((part) => part.plain_text ?? "")
    .join("")
    .trim();
  return text || null;
}

function lessonDateOf(page: NotionPage): string | null {
  const start = page.properties["Lesson Date"]?.date?.start;
  return start ? start.slice(0, 10) : null;
}

function actualTutorOf(page: NotionPage): string | null {
  const id = page.properties["Actual Tutor (New)"]?.people?.[0]?.id?.trim();
  return id || null;
}

function loadEnvFile(filename: string) {
  const text = readFileSync(resolve(process.cwd(), filename), "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function normalizeId(value: string): string {
  return value.replace(/-/g, "").toLowerCase();
}

async function main() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    loadEnvFile(envPath);
  } catch {
    loadEnvFile("/Users/mac/Documents/Business/Kidda/CommunityApp/.env.local");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role is not configured.");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const pages: NotionPage[] = [];
  let cursor: string | null = null;
  do {
    const body: Record<string, unknown> = {
      filter: { property: "Cover Session?", checkbox: { equals: true } },
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;
    const result = await notionJson<{
      results: NotionPage[];
      has_more: boolean;
      next_cursor: string | null;
    }>(`/databases/${NOTION_LESSONS_LOG_DATA_SOURCE_ID}/query`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    pages.push(...result.results);
    cursor = result.has_more ? result.next_cursor : null;
  } while (cursor);

  const { data: mapRows, error: mapError } = await supabase
    .from("notion_tutor_map")
    .select("tutor_id, notion_user_id");
  if (mapError) throw mapError;
  const tutorByNotionUser = new Map(
    (mapRows ?? []).map((row) => [normalizeId(row.notion_user_id as string), row.tutor_id as string])
  );

  const { data: existing, error: existingError } = await supabase
    .from("cohort_lesson_log_entries")
    .select("id, notion_page_id");
  if (existingError) throw existingError;
  const rowByPage = new Map(
    (existing ?? []).map((row) => [normalizeId(row.notion_page_id as string), row.id as string])
  );

  let updated = 0;
  let missing = 0;
  const unmapped: Array<{ title: string | null; date: string | null; notionUserId: string }> = [];

  for (const page of pages) {
    const notionUserId = actualTutorOf(page);
    const actualTutorId = notionUserId
      ? tutorByNotionUser.get(normalizeId(notionUserId)) ?? null
      : null;
    if (!notionUserId || !actualTutorId) {
      unmapped.push({
        title: titleOf(page),
        date: lessonDateOf(page),
        notionUserId: notionUserId ?? "(empty)",
      });
    }
    const rowId = rowByPage.get(normalizeId(page.id));
    if (!rowId) {
      missing += 1;
      console.log(`No app row for Notion cover page ${page.id} (${titleOf(page) ?? "untitled"})`);
      continue;
    }
    const { error } = await supabase
      .from("cohort_lesson_log_entries")
      .update({
        is_cover_session: true,
        actual_tutor_notion_user_id: notionUserId,
        actual_tutor_id: actualTutorId,
      })
      .eq("id", rowId);
    if (error) throw error;
    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        notionCoverPages: pages.length,
        updated,
        missingAppRow: missing,
        unmappedActualTutor: unmapped,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
