/**
 * Verify lead Packages → access grant follow-up (test account only).
 *
 *   node --env-file=.env.local --import tsx scripts/verify-lead-purchase-access-grant.ts
 */
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
require("module").Module._cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
};

const TEST_STUDENT_ID = "b4755c02-e4be-4241-a66f-3d50fe0d33da";
const COHORT_42_ID = "3103fd2c-f359-4503-a4d9-48a3af64327c";
const COHORT_38_NOTION = "381b5ac4-29c6-80fe-917f-e908eb9955f9";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ensureQueueSchema(admin: ReturnType<typeof adminClient>) {
  const { error } = await admin.from("notion_lead_purchase_grant_queue").select("id").limit(1);
  if (!error) return true;
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    console.error(
      "Apply supabase/notion-lead-purchase-grant-queue.sql (or set SUPABASE_ACCESS_TOKEN)."
    );
    console.error(error.message);
    return false;
  }
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/notion-lead-purchase-grant-queue.sql"),
    "utf8"
  );
  const response = await fetch(
    `https://api.supabase.com/v1/projects/pztubczhqkzcwtkstpgi/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  if (!response.ok) {
    throw new Error(`Schema apply failed: ${(await response.text()).slice(0, 400)}`);
  }
  return true;
}

async function main() {
  const admin = adminClient();
  if (!(await ensureQueueSchema(admin))) process.exit(1);

  const { grantAccessFromLinkedLeadPackages } = await import(
    "../src/lib/notion/lead-purchase-access-grant"
  );
  const { notionJson, relationIds, plainTextFromTitle } = await import(
    "../src/lib/notion/client"
  );

  const { data: profile } = await admin
    .from("profiles")
    .select("notion_lead_page_id")
    .eq("id", TEST_STUDENT_ID)
    .maybeSingle();
  if (!profile?.notion_lead_page_id) throw new Error("Test profile has no lead link.");

  console.log("\n=== 1) Clean single package (hello@ → Cohort 42) ===");
  // Soft-remove cohort membership so grant must restore it.
  await admin
    .from("cohort_members")
    .update({ left_at: new Date().toISOString() })
    .eq("user_id", TEST_STUDENT_ID)
    .eq("cohort_id", COHORT_42_ID);

  const clean = await grantAccessFromLinkedLeadPackages(
    admin,
    TEST_STUDENT_ID,
    profile.notion_lead_page_id
  );
  console.log("grant result:", clean);

  const { data: enrollment } = await admin
    .from("course_enrollments")
    .select("id, course_id, cohort_id, delivery_mode")
    .eq("user_id", TEST_STUDENT_ID)
    .eq("cohort_id", COHORT_42_ID)
    .maybeSingle();
  const { data: member } = await admin
    .from("cohort_members")
    .select("cohort_id, left_at")
    .eq("user_id", TEST_STUDENT_ID)
    .eq("cohort_id", COHORT_42_ID)
    .maybeSingle();
  console.log("enrollment:", enrollment);
  console.log("cohort_member:", member);

  console.log("\n=== 2) No Packages → no grant, no queue ===");
  // Use a temporary fake lead page id that we create? Skip Notion create —
  // call resolve path by temporarily using enqueue only when packages empty:
  // Simulate by invoking with a lead that has empty Packages if we can find one,
  // else verify empty-relation branch via direct unit of packagePageIds.length===0
  // by fetching a known empty lead from Cohort 38 interested (none) —
  // Create queue count before/after using a lead page from cache with 0 packages.
  const { count: queueBefore } = await admin
    .from("notion_lead_purchase_grant_queue")
    .select("*", { count: "exact", head: true })
    .eq("resolved", false);

  // Find any lead with 0 packages (sample sales leads).
  const { data: cacheRows } = await admin
    .from("notion_leads_cache")
    .select("notion_page_id, email")
    .limit(40);
  let emptyLead: string | null = null;
  for (const row of cacheRows ?? []) {
    try {
      const page = await notionJson(`/pages/${row.notion_page_id}`);
      if (relationIds(page.properties.Packages).length === 0) {
        emptyLead = row.notion_page_id;
        console.log("empty packages lead:", row.email, emptyLead);
        break;
      }
    } catch {
      /* skip */
    }
  }
  if (emptyLead) {
    const emptyResult = await grantAccessFromLinkedLeadPackages(
      admin,
      TEST_STUDENT_ID,
      emptyLead
    );
    console.log("empty packages result:", emptyResult);
  } else {
    console.log("No empty-Packages lead found in sample — skipped live empty test.");
  }

  const { count: queueAfterEmpty } = await admin
    .from("notion_lead_purchase_grant_queue")
    .select("*", { count: "exact", head: true })
    .eq("resolved", false);
  console.log({ queueBefore, queueAfterEmpty });

  console.log("\n=== 3) Ambiguous (force multiple package page ids via enqueue path) ===");
  // Patch: call grant after temporarily... we can't easily fake Packages on Notion.
  // Instead insert via unresolved path by resolving a lead that has multiple packages,
  // or synthesize by calling enqueue through grantAccess with a lead that has >1.
  let multiLead: string | null = null;
  for (const row of cacheRows ?? []) {
    try {
      const page = await notionJson(`/pages/${row.notion_page_id}`);
      if (relationIds(page.properties.Packages).length > 1) {
        multiLead = row.notion_page_id;
        console.log(
          "multi packages lead:",
          row.email,
          relationIds(page.properties.Packages).length
        );
        break;
      }
    } catch {
      /* skip */
    }
  }
  if (multiLead) {
    const ambiguous = await grantAccessFromLinkedLeadPackages(
      admin,
      TEST_STUDENT_ID,
      multiLead
    );
    console.log("ambiguous result:", ambiguous);
  } else {
    // Force unresolvable single fake page id by using a nonsense page — fetch will fail.
    // Better: enqueue unresolvable by using a package page id that exists in Notion but
    // not in cohorts/package_instances. Use a random uuid as lead? Fetch fails.
    // Use Cohort 38's package page as "lead" wrongly? That won't have Packages.
    console.log("No multi-package lead in sample — simulating unresolvable via fake package relation.");
    // Manually insert queue item mirroring ambiguous path by calling resolve on
    // a lead whose only package page is unlinked — find one.
    for (const row of (cacheRows ?? []).slice(0, 20)) {
      const page = await notionJson(`/pages/${row.notion_page_id}`);
      const pkgs = relationIds(page.properties.Packages);
      if (pkgs.length !== 1) continue;
      const { data: c } = await admin
        .from("cohorts")
        .select("id")
        .eq("notion_page_id", pkgs[0]!)
        .maybeSingle();
      const { data: pi } = await admin
        .from("package_instances")
        .select("id")
        .eq("notion_page_id", pkgs[0]!)
        .maybeSingle();
      if (!c && !pi) {
        console.log("unresolvable package lead:", row.email, pkgs[0]);
        const unres = await grantAccessFromLinkedLeadPackages(
          admin,
          TEST_STUDENT_ID,
          row.notion_page_id
        );
        console.log("unresolvable result:", unres);
        break;
      }
    }
  }

  const { data: openQueue } = await admin
    .from("notion_lead_purchase_grant_queue")
    .select("id, reason, lead_email, raw_package_data")
    .eq("resolved", false)
    .eq("profile_id", TEST_STUDENT_ID)
    .order("created_at", { ascending: false })
    .limit(5);
  console.log("open queue for test profile:", openQueue);

  console.log("\n=== 4) Cohort 38 Packages resolution ===");
  const page = await notionJson(`/pages/${COHORT_38_NOTION}`);
  const confirmed = relationIds(page.properties.Confirmed);
  let cleanResolves = 0;
  for (const leadId of confirmed) {
    const lead = await notionJson(`/pages/${leadId}`);
    const pkgs = relationIds(lead.properties.Packages);
    const name = plainTextFromTitle(lead.properties.Name);
    const email = lead.properties.Email?.email ?? null;
    let ok = false;
    if (pkgs.length === 1) {
      const { data: c } = await admin
        .from("cohorts")
        .select("id, name")
        .eq("notion_page_id", pkgs[0]!)
        .maybeSingle();
      ok = c?.id != null;
      if (ok) cleanResolves += 1;
      console.log({ name, email, packages: pkgs.length, resolvesTo: c?.name ?? null, clean: ok });
    } else {
      console.log({ name, email, packages: pkgs.length, clean: false });
    }
  }
  console.log(
    `Cohort 38 confirmed leads with clean Packages→cohort resolve: ${cleanResolves}/${confirmed.length}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
