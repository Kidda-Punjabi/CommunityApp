/**
 * One-time backfill: reconcile profiles ↔ Notion Leads (App User ID).
 * Match-only — never creates historical Notion leads.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/backfill-profile-notion-lead-links.ts
 *   node --env-file=.env.local --import tsx scripts/backfill-profile-notion-lead-links.ts --apply
 */
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
require("module").Module._cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
};

const apply = process.argv.includes("--apply");

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function countNotionPagesWithAppUserId(): Promise<number> {
  const { notionJson, NOTION_LEADS_DATA_SOURCE_ID } = await import(
    "../src/lib/notion/client"
  );
  let count = 0;
  let cursor: string | undefined;
  do {
    const body: Record<string, unknown> = {
      page_size: 100,
      filter: {
        property: "App User ID",
        rich_text: { is_not_empty: true },
      },
    };
    if (cursor) body.start_cursor = cursor;
    const data = await notionJson<{
      results: unknown[];
      has_more: boolean;
      next_cursor: string | null;
    }>(`/databases/${NOTION_LEADS_DATA_SOURCE_ID}/query`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    count += data.results.length;
    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return count;
}

async function reportPaidSalesCallsCoverage(supabase: ReturnType<typeof adminClient>) {
  // ~350 "paid" rows ≈ Onboarded status or Closed outcome (Package Onboarding set).
  type Row = {
    id: string;
    status: string | null;
    outcome: string | null;
    paid_afterwards: number | null;
    lead_notion_page_id: string | null;
  };
  const rows: Row[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("sales_calls")
      .select("id, status, outcome, paid_afterwards, lead_notion_page_id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...(data as Row[]));
    if (data.length < 1000) break;
    from += 1000;
  }

  const paid = rows.filter(
    (r) => r.status === "Onboarded" || r.outcome === "Closed"
  );

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, notion_lead_page_id")
    .not("notion_lead_page_id", "is", null);

  const profileByLead = new Map<string, string>();
  for (const p of profiles ?? []) {
    if (p.notion_lead_page_id) {
      profileByLead.set(p.notion_lead_page_id, p.id);
    }
  }

  let withLead = 0;
  let withProfileViaLead = 0;
  for (const call of paid) {
    if (!call.lead_notion_page_id) continue;
    withLead += 1;
    if (profileByLead.has(call.lead_notion_page_id)) {
      withProfileViaLead += 1;
    }
  }

  return {
    paidSalesCalls: paid.length,
    paidWithLeadPage: withLead,
    paidResolvingToProfile: withProfileViaLead,
  };
}

async function main() {
  const supabase = adminClient();
  console.log(apply ? "APPLY mode" : "DRY RUN (pass --apply to write)");

  const { count: linkedBefore } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .not("notion_lead_page_id", "is", null);
  const { count: profilesTotal } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });
  const { count: conflictsBefore } = await supabase
    .from("notion_lead_link_conflicts")
    .select("*", { count: "exact", head: true });

  let notionWithAppUserBefore = 0;
  try {
    notionWithAppUserBefore = await countNotionPagesWithAppUserId();
  } catch (error) {
    console.warn(
      "Could not count Notion App User ID pages:",
      error instanceof Error ? error.message : error
    );
  }

  console.log("Before:", {
    profilesLinked: linkedBefore,
    profilesTotal,
    notionWithAppUserId: notionWithAppUserBefore,
    conflicts: conflictsBefore,
  });

  if (!apply) {
    const coverage = await reportPaidSalesCallsCoverage(supabase);
    console.log("Paid sales_calls → profile (current):", coverage);
    console.log("Re-run with --apply to write links.");
    return;
  }

  const { backfillProfileNotionLeadLinks } = await import(
    "../src/lib/notion/lead-sync"
  );
  const result = await backfillProfileNotionLeadLinks(supabase);
  console.log("Backfill result:", result);

  const { count: linkedAfter } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .not("notion_lead_page_id", "is", null);
  const { count: conflictsAfter } = await supabase
    .from("notion_lead_link_conflicts")
    .select("*", { count: "exact", head: true });

  let notionWithAppUserAfter = 0;
  try {
    notionWithAppUserAfter = await countNotionPagesWithAppUserId();
  } catch (error) {
    console.warn(
      "Could not count Notion App User ID pages:",
      error instanceof Error ? error.message : error
    );
  }

  const { data: conflictSample } = await supabase
    .from("notion_lead_link_conflicts")
    .select("lead_email, details, existing_notion_page_id, attempted_notion_page_id")
    .order("created_at", { ascending: false })
    .limit(20);

  const coverage = await reportPaidSalesCallsCoverage(supabase);

  console.log("After:", {
    profilesLinked: linkedAfter,
    profilesTotal,
    notionWithAppUserId: notionWithAppUserAfter,
    conflicts: conflictsAfter,
    conflictsDelta: (conflictsAfter ?? 0) - (conflictsBefore ?? 0),
  });
  console.log("Recent conflicts:", conflictSample);
  console.log(
    `Paid sales_calls (Onboarded|Closed=${coverage.paidSalesCalls}): ${coverage.paidResolvingToProfile} of ${coverage.paidSalesCalls} resolve to a profile via lead_notion_page_id.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
