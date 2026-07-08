/**
 * Import unresolved Notion group cohorts and refresh all Notion rosters.
 *
 * Usage: npx tsx scripts/sync-notion-cohorts.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { autoLinkAllUnresolvedInbox, resyncAllNotionLinkedPackagesFromNotion } from "../src/lib/notion/package-sync";
import { syncAllNotionLinkedPackageRosters } from "../src/lib/notion/package-roster-sync";

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const autoLink = await autoLinkAllUnresolvedInbox(supabase);
  console.log(
    `Imported ${autoLink.linked} Notion package/cohort row(s); ${autoLink.skipped} still unresolved.`
  );
  if (autoLink.errors.length > 0) {
    console.log("Import notes:");
    for (const message of autoLink.errors.slice(0, 15)) {
      console.log(`- ${message}`);
    }
  }

  const schedule = await resyncAllNotionLinkedPackagesFromNotion(supabase);
  console.log(
    `Refreshed schedules for ${schedule.updated} Notion-linked package(s); ${schedule.rosterSynced} roster lead(s) synced.`
  );
  if (schedule.errors.length > 0) {
    console.log("Schedule sync notes:");
    for (const message of schedule.errors.slice(0, 15)) {
      console.log(`- ${message}`);
    }
  }

  const roster = await syncAllNotionLinkedPackageRosters(supabase);
  console.log(`Synced ${roster.synced} roster lead(s) from Notion.`);
  if (roster.errors.length > 0) {
    console.log("Roster sync notes:");
    for (const message of roster.errors.slice(0, 15)) {
      console.log(`- ${message}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
