/**
 * One-time backfill: cohorts 36–40 from live Notion + reconcile cohort_members from Confirmed.
 *
 * Usage (load .env.local before Notion client initializes):
 *   node --env-file=.env.local ./node_modules/.bin/tsx scripts/backfill-cohorts-36-40-from-notion.ts
 *   node --env-file=.env.local ./node_modules/.bin/tsx scripts/backfill-cohorts-36-40-from-notion.ts --dry-run
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { reconcileCohortMembersFromNotionConfirmed } from "../src/lib/group-purchase/reconcile-cohort-members-from-notion";

const TARGET_COHORT_NAMES = ["Cohort 36", "Cohort 37", "Cohort 38", "Cohort 39", "Cohort 40"];

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnv();
  const dryRun = process.argv.includes("--dry-run");

  const { syncAllGroupCohortsFromNotion } = await import(
    "../src/lib/notion/sync-group-cohorts-for-checkout"
  );
  const { refreshCohortFromNotionPage } = await import("../src/lib/notion/package-sync");
  const { upsertNotionLeadsCache } = await import("../src/lib/notion/lead-sync");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  if (!process.env.NOTION_API_KEY?.trim()) {
    throw new Error("NOTION_API_KEY is required for live Notion pull.");
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(dryRun ? "DRY RUN — no writes\n" : "Live backfill\n");

  const cache = await upsertNotionLeadsCache(supabase, { fullSync: true }).catch((error) => {
    console.warn(
      "Leads cache refresh skipped (write-back matching may be weaker):",
      error instanceof Error ? error.message : error
    );
    return { upserted: 0, notionPageCount: 0, errors: [] as string[] };
  });
  console.log(
    `Leads cache refreshed: ${cache.upserted} row(s) from ${cache.notionPageCount} Notion page(s).`
  );
  if (cache.errors.length) {
    console.log("Leads cache notes:", cache.errors.slice(0, 5).join("; "));
  }

  if (!dryRun) {
    console.log("\nSyncing all Group cohort rows from Notion…");
    const sync = await syncAllGroupCohortsFromNotion(supabase);
    console.log(`Group cohort sync: ${sync.synced} updated/created; ${sync.errors.length} error(s).`);
    if (sync.errors.length) {
      console.log(sync.errors.slice(0, 10).map((e) => `- ${e}`).join("\n"));
    }
  }

  for (const name of TARGET_COHORT_NAMES) {
    console.log(`\n--- ${name} ---`);

    const { data: cohort, error } = await supabase
      .from("cohorts")
      .select("id, name, notion_page_id, status, notion_confirmed_count")
      .eq("name", name)
      .maybeSingle();

    if (error) {
      console.log(`Load error: ${error.message}`);
      continue;
    }

    if (!cohort) {
      console.log("No Supabase cohort row with this name — check Notion Group sync / course match.");
      continue;
    }

    console.log(
      `Before: status=${cohort.status} notion_page_id=${cohort.notion_page_id ?? "null"} notion_confirmed_count=${cohort.notion_confirmed_count ?? "?"}`
    );

    if (dryRun) {
      console.log("Would refresh from Notion and reconcile cohort_members.");
      continue;
    }

    if (!cohort.notion_page_id) {
      console.log("SKIP: no notion_page_id after sync — check Notion Delivery Type / course link.");
      continue;
    }

    const refresh = await refreshCohortFromNotionPage(supabase, cohort.id);
    if (!refresh.ok) {
      console.log(`Notion refresh failed: ${refresh.error}`);
      continue;
    }

    const { data: after } = await supabase
      .from("cohorts")
      .select("status, notion_confirmed_count, weekly_session_has_time, start_date, end_date")
      .eq("id", cohort.id)
      .single();

    console.log(
      `After Notion pull: status=${after?.status} confirmed=${after?.notion_confirmed_count} session_time=${after?.weekly_session_has_time} start=${after?.start_date?.slice(0, 10) ?? "—"} end=${after?.end_date?.slice(0, 10) ?? "—"}`
    );

    const reconcile = await reconcileCohortMembersFromNotionConfirmed(supabase, cohort.id);
    console.log(
      `Members reconcile: confirmed_leads=${reconcile.confirmedLeadCount} active_profiles=${reconcile.added} left_at_set=${reconcile.removed} leads_without_app_profile=${reconcile.skippedNoProfile}`
    );
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
