/**
 * Prove Notion Capacity is copied onto a NEW cohorts row (insert path).
 *
 * Creates two throwaway Notion Group pages, syncs them into Supabase, checks
 * capacity 4 vs fallback 7, then archives the Notion pages and deletes the
 * matching cohorts. Safe to re-run.
 *
 * Usage: npx tsx scripts/verify-notion-cohort-capacity-insert.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import Module from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const STAMP = new Date().toISOString().replace(/[:.]/g, "-");
const TITLE_CAP4 = `TEST DELETE Kids Circle closeout cap4 ${STAMP}`;
const TITLE_FALLBACK = `TEST DELETE Kids Circle closeout no-cap ${STAMP}`;

function loadEnvFile(filename: string) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

type NotionPage = {
  id: string;
  last_edited_time: string;
  properties: Record<string, unknown>;
};

function installServerOnlyShim() {
  const serverOnlyShim = join(tmpdir(), "kidda-server-only-shim.cjs");
  writeFileSync(serverOnlyShim, "module.exports = {};\n");
  const originalResolve = (
    Module as unknown as { _resolveFilename: (...args: unknown[]) => string }
  )._resolveFilename;
  (Module as unknown as { _resolveFilename: (...args: unknown[]) => string })._resolveFilename =
    function (request: string, ...rest: unknown[]) {
      if (request === "server-only") return serverOnlyShim;
      return originalResolve.call(this, request, ...rest);
    };
}

async function main() {
  installServerOnlyShim();

  const {
    NOTION_PACKAGE_DATA_SOURCE_ID,
    notionJson,
  } = await import("../src/lib/notion/client");
  const { cohortNotionColumnsAvailable } = await import("../src/lib/notion/notion-cohort-link");
  const {
    createOrUpdateCohortFromNotionPage,
    loadNotionTutorMap,
    parseNotionPackagePage,
  } = await import("../src/lib/notion/package-sync");
  const { loadPackageCatalog, resolveNotionSyncTargetFromPage } = await import(
    "../src/lib/notion/resolve-package-link"
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  if (!process.env.NOTION_API_KEY?.trim()) {
    throw new Error("NOTION_API_KEY is required.");
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  async function createTestPage(title: string, capacity: number | null): Promise<string> {
    const properties: Record<string, unknown> = {
      "Package Name": {
        title: [{ type: "text", text: { content: title } }],
      },
      "Delivery Type": { select: { name: "Group" } },
      Course: { select: { name: "Kids Beginners Course" } },
      Status: { status: { name: "Pre-scheduling" } },
    };
    if (capacity != null) {
      properties.Capacity = { number: capacity };
    }

    const created = await notionJson<{ id: string }>("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: NOTION_PACKAGE_DATA_SOURCE_ID },
        properties,
      }),
    });
    return created.id;
  }

  async function fetchPage(pageId: string): Promise<NotionPage> {
    return notionJson<NotionPage>(`/pages/${pageId}`);
  }

  async function archivePage(pageId: string): Promise<void> {
    await notionJson(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
    });
  }

  const catalog = await loadPackageCatalog(supabase);
  const { byNotionUserId } = await loadNotionTutorMap(supabase);
  const notionColumnsAvailable = await cohortNotionColumnsAvailable(supabase);
  const createdPageIds: string[] = [];
  const createdCohortIds: string[] = [];

  async function syncPage(pageId: string) {
    const raw = await fetchPage(pageId);
    const page = parseNotionPackagePage(raw);
    const resolved = resolveNotionSyncTargetFromPage(
      page,
      catalog.packages.filter((pkg) => (pkg as { active?: boolean }).active !== false),
      catalog.courses
    );
    if (!resolved.ok) {
      throw new Error(`Could not resolve Notion page ${pageId}: ${resolved.detail}`);
    }
    const result = await createOrUpdateCohortFromNotionPage(supabase, page, resolved.link, {
      syncRoster: false,
      tutorMapByNotionUserId: byNotionUserId,
      notionColumnsAvailable,
    });
    if (!result.ok || !result.cohortId) {
      throw new Error(result.error ?? `Failed to create cohort for ${pageId}`);
    }
    createdCohortIds.push(result.cohortId);
    const { data: row, error } = await supabase
      .from("cohorts")
      .select("id, name, capacity, notion_page_id")
      .eq("id", result.cohortId)
      .single();
    if (error || !row) {
      throw new Error(error?.message ?? "Cohort row missing after insert.");
    }
    return row as { id: string; name: string; capacity: number; notion_page_id: string | null };
  }

  try {
    const cap4PageId = await createTestPage(TITLE_CAP4, 4);
    createdPageIds.push(cap4PageId);
    const fallbackPageId = await createTestPage(TITLE_FALLBACK, null);
    createdPageIds.push(fallbackPageId);

    const cap4 = await syncPage(cap4PageId);
    const fallback = await syncPage(fallbackPageId);

    const cap4Pass = cap4.capacity === 4;
    const fallbackPass = fallback.capacity === 7;

    console.log(
      JSON.stringify(
        {
          cap4: { ...cap4, pass: cap4Pass, expected: 4 },
          fallback: { ...fallback, pass: fallbackPass, expected: 7 },
        },
        null,
        2
      )
    );

    if (!cap4Pass || !fallbackPass) {
      throw new Error("Capacity insert path did not match expected values.");
    }

    console.log("PASS: new Notion cohort with Capacity 4 inserted as 4; blank Capacity fell back to 7.");
  } finally {
    for (const cohortId of createdCohortIds) {
      await supabase.from("cohort_members").delete().eq("cohort_id", cohortId);
      await supabase.from("course_enrollments").delete().eq("cohort_id", cohortId);
      await supabase.from("notion_sync_inbox").delete().eq("resolved_cohort_id", cohortId);
      const { error } = await supabase.from("cohorts").delete().eq("id", cohortId);
      if (error) {
        console.warn(`Could not delete test cohort ${cohortId}: ${error.message}`);
      }
    }
    for (const pageId of createdPageIds) {
      try {
        await supabase.from("notion_sync_inbox").delete().eq("notion_page_id", pageId);
        await archivePage(pageId);
      } catch (error) {
        console.warn(
          `Could not archive Notion page ${pageId}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
