import { loadPackageCatalog, resolveNotionSyncTargetFromPage } from "@/lib/notion/resolve-package-link";
import {
  createOrUpdateCohortFromNotionPage,
  parseNotionPackagePage,
  type ParsedNotionPackagePage,
} from "@/lib/notion/package-sync";
import { NOTION_PACKAGE_DATA_SOURCE_ID, notionJson } from "@/lib/notion/client";
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

export async function queryNotionGroupPackagePages(): Promise<ParsedNotionPackagePage[]> {
  const pages: ParsedNotionPackagePage[] = [];
  let cursor: string | null = null;

  do {
    const body: Record<string, unknown> = {
      page_size: 100,
      filter: {
        property: "Delivery Type",
        select: { equals: "Group" },
      },
    };
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

/**
 * Pull every Notion Group package row for a course and upsert linked cohorts.
 * Used before the checkout cohort picker so new recruiting cohorts appear without waiting for cron.
 */
export async function syncGroupCohortsForCourseFromNotion(
  supabase: SupabaseClient,
  courseId: string
): Promise<{ synced: number; errors: string[] }> {
  const catalog = await loadPackageCatalog(supabase);
  const pages = await queryNotionGroupPackagePages();

  let synced = 0;
  const errors: string[] = [];

  for (const page of pages) {
    const resolved = resolveNotionSyncTargetFromPage(page, catalog.packages, catalog.courses);
    if (!resolved.ok || resolved.link.kind !== "cohort") continue;
    if (resolved.link.courseId !== courseId) continue;

    const result = await createOrUpdateCohortFromNotionPage(supabase, page, resolved.link);
    if (result.ok) {
      synced += 1;
    } else {
      errors.push(`${page.packageName ?? page.pageId}: ${result.error ?? "Sync failed"}`);
    }
  }

  return { synced, errors };
}

/** Keeps Supabase cohort rows aligned with all Notion Group packages (cron / ops). */
export async function syncAllGroupCohortsFromNotion(
  supabase: SupabaseClient
): Promise<{ synced: number; errors: string[] }> {
  const catalog = await loadPackageCatalog(supabase);
  const courseIds = [
    ...new Set(
      catalog.packages
        .filter((pkg) => pkg.delivery_mode === "group")
        .map((pkg) => pkg.course_id)
    ),
  ];

  let synced = 0;
  const errors: string[] = [];

  for (const courseId of courseIds) {
    const result = await syncGroupCohortsForCourseFromNotion(supabase, courseId);
    synced += result.synced;
    errors.push(...result.errors);
  }

  return { synced, errors };
}
