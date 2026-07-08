/**
 * Backfill Notion lead rosters for all package_instances linked to Notion.
 *
 * Prerequisites: run supabase/notion-package-roster.sql in the Supabase SQL editor first.
 *
 * Usage: npx tsx scripts/sync-notion-package-rosters.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
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

  const { error: probeError } = await supabase
    .from("package_instance_notion_roster")
    .select("id")
    .limit(1);

  if (probeError) {
    console.warn(
      "package_instance_notion_roster table not found — caching rosters on notion_sync_inbox instead."
    );
    console.warn("Run supabase/notion-package-roster.sql when you can for the dedicated roster table.");
  }

  const result = await syncAllNotionLinkedPackageRosters(supabase);
  console.log(`Synced ${result.synced} roster lead(s) from Notion.`);
  if (result.errors.length > 0) {
    console.log(`Errors (${result.errors.length}):`);
    for (const message of result.errors.slice(0, 20)) {
      console.log(`- ${message}`);
    }
    if (result.errors.length > 20) {
      console.log(`... and ${result.errors.length - 20} more`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
