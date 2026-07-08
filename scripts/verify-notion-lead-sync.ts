import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

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

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { ensureLeadsAppUserIdProperty, fetchDatabaseSchema, NOTION_LEADS_DATA_SOURCE_ID } =
    await import("../src/lib/notion/client");
  const { linkLeadsFromNotion } = await import("../src/lib/notion/lead-sync");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error: profileCol } = await supabase
    .from("profiles")
    .select("notion_lead_page_id")
    .limit(1);
  console.log(
    profileCol ? `FAIL schema profiles.notion_lead_page_id: ${profileCol.message}` : "PASS schema profiles.notion_lead_page_id"
  );

  await ensureLeadsAppUserIdProperty();
  const schema = await fetchDatabaseSchema(NOTION_LEADS_DATA_SOURCE_ID);
  console.log(
    "App User ID" in schema.properties
      ? "PASS Leads App User ID property exists"
      : "FAIL Leads App User ID property missing"
  );

  if (profileCol) {
    console.log("Skipping link job — run supabase/notion-lead-sync.sql first.");
    return;
  }

  const result = await linkLeadsFromNotion(supabase);
  console.log("Link job:", result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
