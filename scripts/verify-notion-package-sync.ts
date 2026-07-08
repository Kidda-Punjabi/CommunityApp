/**
 * End-to-end verification for Notion <-> package_instances sync.
 *
 * Usage:
 *   npx tsx scripts/verify-notion-package-sync.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filename: string) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
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

type Check = { name: string; pass: boolean; detail: string };

async function main(): Promise<Check[]> {
  const { createClient } = await import("@supabase/supabase-js");
  const {
    packageSyncFieldsChanged,
    pullPackageInstancesFromNotion,
    pushPackageInstanceToNotion,
  } = await import("../src/lib/notion/package-sync");
  const { notionJson } = await import("../src/lib/notion/client");

  const checks: Check[] = [];
  function record(name: string, pass: boolean, detail: string) {
    checks.push({ name, pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"} — ${name}: ${detail}`);
  }

  const TEST_NAME = `VERIFY SYNC ${new Date().toISOString().slice(0, 19)}`;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const packageDbId = process.env.NOTION_PACKAGE_DATA_SOURCE_ID;
  if (!url || !key || !packageDbId) {
    throw new Error("Missing Supabase or Notion env configuration.");
  }

  const supabase = createClient(url, key);

  // 1) Schema
  for (const col of ["notion_page_id", "notion_sync_status"] as const) {
    const { error } = await supabase.from("package_instances").select(col).limit(1);
    record(`schema package_instances.${col}`, !error, error?.message ?? "present");
  }
  const { error: inboxErr } = await supabase.from("notion_sync_inbox").select("id").limit(1);
  record("schema notion_sync_inbox", !inboxErr, inboxErr?.message ?? "present");

  // 2) Find a non-group package for test row
  const { data: pkg } = await supabase
    .from("packages")
    .select("id, course_id, name, delivery_mode")
    .neq("delivery_mode", "group")
    .limit(1)
    .maybeSingle();

  if (!pkg) throw new Error("No non-group package found for test insert.");

  const { data: instance, error: insertError } = await supabase
    .from("package_instances")
    .insert({
      package_id: pkg.id,
      course_id: pkg.course_id,
      name: TEST_NAME,
      status: "pre_scheduling",
      capacity: 1,
      start_date: "2026-08-01T00:00:00.000Z",
      end_date: "2026-09-01T00:00:00.000Z",
    })
    .select("id, notion_page_id, notion_sync_status, notion_synced_at, capacity, updated_at")
    .single();

  if (insertError || !instance) throw new Error(insertError?.message ?? "Insert failed");
  record("create test package_instances row", true, instance.id);

  const syncedAtBeforeCapacity = instance.notion_synced_at;

  // 3) Push to Notion
  const push = await pushPackageInstanceToNotion(supabase, instance.id);
  record("push to Notion", push.ok, push.error ?? `page sync ok${push.skippedTutor ? " (tutor skipped — no map)" : ""}`);

  const { data: afterPush } = await supabase
    .from("package_instances")
    .select("notion_page_id, notion_sync_status, notion_sync_error")
    .eq("id", instance.id)
    .single();

  record(
    "notion_page_id stored",
    Boolean(afterPush?.notion_page_id),
    afterPush?.notion_page_id ?? "missing"
  );
  record(
    "notion_sync_status synced",
    afterPush?.notion_sync_status === "synced",
    afterPush?.notion_sync_status ?? "unknown"
  );

  if (afterPush?.notion_page_id) {
    const page = await notionJson<{
      id: string;
      properties: Record<string, unknown>;
    }>(`/pages/${afterPush.notion_page_id}`);

    const inScope = ["Package Name", "Start Date", "End Date", "Status", "Tutor"];
    const props = page.properties as Record<string, Record<string, unknown>>;
    const title = (props["Package Name"]?.title as Array<{ plain_text?: string }> | undefined)
      ?.map((part) => part.plain_text ?? "")
      .join("");
    const status =
      (props.Status?.status as { name?: string } | undefined)?.name ??
      (props.Status?.select as { name?: string } | undefined)?.name;
    const start = (props["Start Date"]?.date as { start?: string } | undefined)?.start;
    const end = (props["End Date"]?.date as { start?: string } | undefined)?.start;

    record("Package Name matches app", title === TEST_NAME, title);
    record("Status matches app", status === "Pre-scheduling", status ?? "missing");
    record("Start Date matches app", start?.startsWith("2026-08-01") ?? false, start ?? "missing");
    record("End Date matches app", end?.startsWith("2026-09-01") ?? false, end ?? "missing");
    record(
      "Tutor unset when no tutor map",
      !props.Tutor?.people || (props.Tutor.people as unknown[]).length === 0,
      "tutor not pushed without mapping"
    );
    void inScope;

    // 4) Edit Notion page
    await notionJson(`/pages/${afterPush.notion_page_id}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          Status: { status: { name: "Scheduled" } },
          "Start Date": { date: { start: "2026-08-15" } },
        },
      }),
    });
    record("edit Notion Status + Start Date", true, "patched");

    // small delay for last_edited_time
    await new Promise((r) => setTimeout(r, 1500));

    const pageAfterEdit = await notionJson<{ last_edited_time: string }>(
      `/pages/${afterPush.notion_page_id}`
    );
    const { data: beforePull } = await supabase
      .from("package_instances")
      .select("notion_synced_at")
      .eq("id", instance.id)
      .single();
    record(
      "Notion edit reached pull window",
      new Date(pageAfterEdit.last_edited_time).getTime() >=
        new Date(beforePull?.notion_synced_at ?? 0).getTime(),
      `${pageAfterEdit.last_edited_time} vs ${beforePull?.notion_synced_at ?? "null"}`
    );

    const pull = await pullPackageInstancesFromNotion(supabase);
    record("pull cron job", pull.errors.length === 0, `pulled=${pull.pulled}, errors=${pull.errors.join("; ") || "none"}`);

    const { data: afterPull } = await supabase
      .from("package_instances")
      .select("status, start_date")
      .eq("id", instance.id)
      .single();

    record(
      "app status updated from Notion",
      afterPull?.status === "scheduled",
      afterPull?.status ?? "missing"
    );
    record(
      "app start_date updated from Notion",
      Boolean(afterPull?.start_date?.startsWith("2026-08-15")),
      afterPull?.start_date ?? "missing"
    );
  }

  // 5) Create brand-new Notion row -> inbox
  const inboxPage = await notionJson<{ id: string }>("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: packageDbId },
      properties: {
        "Package Name": { title: [{ text: { content: `INBOX VERIFY ${Date.now()}` } }] },
        Status: { status: { name: "Recruiting" } },
      },
    }),
  });

  await new Promise((r) => setTimeout(r, 1500));
  const pull2 = await pullPackageInstancesFromNotion(supabase);
  record("pull after Notion-only create", pull2.inboxed >= 1, `inboxed=${pull2.inboxed}`);

  const { data: inboxRow } = await supabase
    .from("notion_sync_inbox")
    .select("id, resolved")
    .eq("notion_page_id", inboxPage.id)
    .maybeSingle();
  record("Notion-only row in inbox", Boolean(inboxRow), inboxRow?.id ?? "not found");

  const { data: phantom } = await supabase
    .from("package_instances")
    .select("id")
    .eq("notion_page_id", inboxPage.id)
    .maybeSingle();
  record("no phantom package_instances row", !phantom, phantom?.id ?? "none");

  // 6) Capacity-only update should not trigger sync-field change
  const capacityOnly = packageSyncFieldsChanged(
    {
      name: TEST_NAME,
      start_date: "2026-08-15",
      end_date: "2026-09-01",
      status: "scheduled",
      tutor_id: null,
      capacity: 1,
    },
    {
      name: TEST_NAME,
      start_date: "2026-08-15",
      end_date: "2026-09-01",
      status: "scheduled",
      tutor_id: null,
      capacity: 2,
    }
  );
  record("capacity-only change ignored by sync filter", !capacityOnly, String(capacityOnly));

  const { data: beforeCap } = await supabase
    .from("package_instances")
    .select("notion_synced_at")
    .eq("id", instance.id)
    .single();

  await supabase.from("package_instances").update({ capacity: 2 }).eq("id", instance.id);
  await new Promise((r) => setTimeout(r, 1000));

  const { data: afterCap } = await supabase
    .from("package_instances")
    .select("notion_synced_at, capacity")
    .eq("id", instance.id)
    .single();

  record(
    "capacity update did not refresh notion_synced_at (no webhook push in script)",
    afterCap?.notion_synced_at === beforeCap?.notion_synced_at,
    `capacity=${afterCap?.capacity}, synced_at unchanged=${afterCap?.notion_synced_at === beforeCap?.notion_synced_at}`
  );

  // Cleanup test instance (keep Notion pages for user inspection)
  await supabase.from("package_instances").delete().eq("id", instance.id);

  return checks;
}

main()
  .then((checks) => {
    console.log("\n=== SUMMARY ===");
    const failed = checks.filter((c) => !c.pass);
    console.log(`Passed ${checks.length - failed.length}/${checks.length}`);
    if (failed.length) {
      console.log("Failures:");
      for (const f of failed) console.log(`- ${f.name}: ${f.detail}`);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
