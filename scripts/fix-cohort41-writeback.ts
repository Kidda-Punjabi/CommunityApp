/**
 * One-off: complete stuck Cohort 41 Confirmed write-back for hello@kidda.app
 * and resolve attention row 72804887-751b-4650-9d99-e7e57950847b.
 *
 *   node --env-file=.env.local --import tsx scripts/fix-cohort41-writeback.ts
 */
import { createClient } from "@supabase/supabase-js";

const USER_ID = "b4755c02-e4be-4241-a66f-3d50fe0d33da";
const COHORT_ID = "c9741488-fbec-4a15-bbaf-916f71bdb7c8";
const LEAD_PAGE_ID = "3a4b5ac4-29c6-81f4-a338-f3689160cdd2";
const ATTENTION_ID = "72804887-751b-4650-9d99-e7e57950847b";

const NOTION_VERSION = "2022-06-28";

function notionHeaders() {
  const key = process.env.NOTION_API_KEY?.trim();
  if (!key) throw new Error("Missing NOTION_API_KEY");
  return {
    Authorization: `Bearer ${key}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

async function notionJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: { ...notionHeaders(), ...(init?.headers ?? {}) },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Notion ${response.status}: ${body.slice(0, 500)}`);
  return JSON.parse(body) as T;
}

function relationIds(
  value: { relation?: Array<{ id?: string }> } | undefined
): string[] {
  return (value?.relation ?? [])
    .map((item) => item.id)
    .filter((id): id is string => Boolean(id));
}

function idsEqual(a: string, b: string) {
  return a.replace(/-/g, "").toLowerCase() === b.replace(/-/g, "").toLowerCase();
}

async function addLeadToConfirmed(packagePageId: string, leadPageId: string) {
  const page = await notionJson<{
    properties: Record<string, { relation?: Array<{ id?: string }> }>;
  }>(`/pages/${packagePageId}`);

  const confirmed = new Set(relationIds(page.properties.Confirmed));
  confirmed.add(leadPageId);

  const interested = relationIds(page.properties.Interested).filter(
    (id) => !idsEqual(id, leadPageId)
  );
  const waiting = relationIds(page.properties["Waiting for Payment"]).filter(
    (id) => !idsEqual(id, leadPageId)
  );

  await notionJson(`/pages/${packagePageId}`, {
    method: "PATCH",
    body: JSON.stringify({
      properties: {
        Confirmed: { relation: [...confirmed].map((id) => ({ id })) },
        Interested: { relation: interested.map((id) => ({ id })) },
        "Waiting for Payment": { relation: waiting.map((id) => ({ id })) },
      },
    }),
  });
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const admin = createClient(url, key);

  const { data: cohort, error: cohortError } = await admin
    .from("cohorts")
    .select("id, name, notion_page_id")
    .eq("id", COHORT_ID)
    .single();
  if (cohortError || !cohort?.notion_page_id) {
    throw new Error(cohortError?.message ?? "Cohort missing notion_page_id");
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("notion_lead_page_id, full_name")
    .eq("id", USER_ID)
    .single();

  console.log("profile", profile);
  console.log("cohort", cohort.name, cohort.notion_page_id);

  await addLeadToConfirmed(cohort.notion_page_id, LEAD_PAGE_ID);

  const page = await notionJson<{
    properties: Record<
      string,
      { relation?: Array<{ id?: string }>; title?: Array<{ plain_text?: string }> }
    >;
  }>(`/pages/${cohort.notion_page_id}`);

  const confirmed = relationIds(page.properties.Confirmed);
  const hit = confirmed.some((id) => idsEqual(id, LEAD_PAGE_ID));
  console.log("Confirmed ids:", confirmed);
  console.log("Lead in Confirmed:", hit);

  // Resolve all open attention for this user+cohort, including the known row
  const resolvedAt = new Date().toISOString();
  const { error: resolveError } = await admin
    .from("notion_cohort_writeback_attention")
    .update({ resolved_at: resolvedAt })
    .eq("user_id", USER_ID)
    .eq("cohort_id", COHORT_ID)
    .is("resolved_at", null);
  if (resolveError) throw new Error(resolveError.message);

  const { data: attention } = await admin
    .from("notion_cohort_writeback_attention")
    .select("id, reason, resolved_at")
    .eq("id", ATTENTION_ID)
    .single();
  console.log("attention", attention);

  // Pull lead page title for confirmation
  const lead = await notionJson<{
    properties: { Name?: { title?: Array<{ plain_text?: string }> } };
  }>(`/pages/${LEAD_PAGE_ID}`);
  const leadName = (lead.properties.Name?.title ?? [])
    .map((t) => t.plain_text ?? "")
    .join("")
    .trim();
  console.log("Lead page title:", leadName || "(empty)");

  if (!hit || !attention?.resolved_at) {
    process.exit(1);
  }

  console.log("OK — Cohort 41 Confirmed includes lead; attention resolved.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
