import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Current stable Graph / Marketing API version. */
const GRAPH_API_VERSION = "v26.0";

const INSIGHT_FIELDS = [
  "date_start",
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
  "spend",
  "impressions",
  "clicks",
  "actions",
  "account_currency",
].join(",");

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80000, 80003, 80004, 80014]);
const MAX_RANGE_DAYS = 31;
const MAX_PAGES = 500;
const UPSERT_CHUNK = 200;

type InsightAction = { action_type?: string; value?: string };

type InsightRow = {
  date_start?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: InsightAction[];
  account_currency?: string;
};

type SpendInsert = {
  date: string;
  ad_account_id: string;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_id: string;
  ad_name: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  meta_leads: number;
  currency: string | null;
  synced_at: string;
};

function stripSecrets(message: string): string {
  const token = Deno.env.get("META_ACCESS_TOKEN") ?? "";
  let out = message;
  if (token.length > 0) out = out.split(token).join("[redacted]");
  out = out.replace(/access_token=[^&\s"']+/gi, "access_token=[redacted]");
  out = out.replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
  return out.slice(0, 2000);
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function tokensEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Gateway already verified the signature when verify_jwt is on. */
function jwtRole(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(padded));
    return typeof json.role === "string" ? json.role : null;
  } catch {
    return null;
  }
}

function londonToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
}

function inclusiveDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isGraphUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname === "graph.facebook.com";
  } catch {
    return false;
  }
}

function leadCount(actions: InsightAction[] | undefined): number {
  if (!actions) return 0;
  let total = 0;
  for (const action of actions) {
    if (action.action_type === "lead") total += Number(action.value) || 0;
  }
  return Math.round(total);
}

function asInt(value: string | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function asMoney(value: string | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}

function textOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function isCallerAllowed(authHeader: string): Promise<boolean> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (tokensEqual(token, serviceKey) || jwtRole(token) === "service_role") return true;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return false;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return false;
  return data.user.app_metadata?.role === "admin";
}

async function readRange(req: Request): Promise<{ dateFrom: string; dateTo: string } | { error: string }> {
  let dateFrom = "";
  let dateTo = "";

  if (req.method === "GET") {
    const url = new URL(req.url);
    dateFrom = url.searchParams.get("date_from")?.trim() ?? "";
    dateTo = url.searchParams.get("date_to")?.trim() ?? "";
  } else {
    const text = await req.text();
    if (text.trim()) {
      let body: { date_from?: unknown; date_to?: unknown };
      try {
        body = JSON.parse(text);
      } catch {
        return { error: "Invalid JSON." };
      }
      if (body.date_from != null) dateFrom = String(body.date_from).trim();
      if (body.date_to != null) dateTo = String(body.date_to).trim();
    }
  }

  if (!dateFrom && !dateTo) {
    const today = londonToday();
    return { dateFrom: addDays(today, -6), dateTo: today };
  }

  const from = parseDate(dateFrom);
  const to = parseDate(dateTo);
  if (!from || !to) return { error: "date_from and date_to must be YYYY-MM-DD." };
  if (from > to) return { error: "date_from must be on or before date_to." };
  if (inclusiveDays(from, to) > MAX_RANGE_DAYS) {
    return { error: `Date range must be ${MAX_RANGE_DAYS} days or fewer. Backfill one month at a time.` };
  }
  return { dateFrom: from, dateTo: to };
}

async function fetchInsightsPage(url: string): Promise<{ data: InsightRow[]; next: string | null }> {
  let delayMs = 2_000;
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url);
    const text = await response.text();
    let body: {
      data?: InsightRow[];
      paging?: { next?: string };
      error?: { message?: string; code?: number };
    };
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`Meta insights returned non-JSON (HTTP ${response.status}).`);
    }

    const code = body.error?.code;
    const rateLimited = response.status === 429 || (code != null && RATE_LIMIT_CODES.has(code));
    if (rateLimited && attempt < 4) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const wait =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 30_000)
          : delayMs;
      await sleep(wait);
      delayMs = Math.min(delayMs * 2, 30_000);
      continue;
    }

    if (!response.ok || body.error) {
      const message = body.error?.message ?? `Meta insights failed (HTTP ${response.status}).`;
      throw new Error(stripSecrets(message));
    }

    const next = body.paging?.next && isGraphUrl(body.paging.next) ? body.paging.next : null;
    return { data: body.data ?? [], next };
  }
  throw new Error("Meta insights rate limit persisted after retries.");
}

function toSpendRow(row: InsightRow, adAccountId: string, syncedAt: string): SpendInsert | null {
  const date = row.date_start ? parseDate(row.date_start) : null;
  const adId = textOrNull(row.ad_id);
  if (!date || !adId) return null;
  return {
    date,
    ad_account_id: adAccountId,
    campaign_id: textOrNull(row.campaign_id),
    campaign_name: textOrNull(row.campaign_name),
    adset_id: textOrNull(row.adset_id),
    adset_name: textOrNull(row.adset_name),
    ad_id: adId,
    ad_name: textOrNull(row.ad_name),
    spend: asMoney(row.spend),
    impressions: asInt(row.impressions),
    clicks: asInt(row.clicks),
    meta_leads: leadCount(row.actions),
    currency: textOrNull(row.account_currency),
    synced_at: syncedAt,
  };
}

async function upsertSpend(admin: SupabaseClient, rows: SpendInsert[]): Promise<number> {
  const deduped = new Map<string, SpendInsert>();
  for (const row of rows) deduped.set(`${row.date}:${row.ad_id}`, row);
  const values = [...deduped.values()];
  for (let i = 0; i < values.length; i += UPSERT_CHUNK) {
    const chunk = values.slice(i, i + UPSERT_CHUNK);
    const { error } = await admin.from("meta_ad_spend_daily").upsert(chunk, {
      onConflict: "date,ad_id",
    });
    if (error) throw new Error(stripSecrets(error.message));
  }
  return values.length;
}

async function recordRun(
  admin: SupabaseClient,
  row: {
    started_at: string;
    finished_at: string;
    status: "success" | "error";
    date_from: string | null;
    date_to: string | null;
    rows_upserted: number;
    error: string | null;
  }
): Promise<string | null> {
  const { data, error } = await admin
    .from("meta_sync_runs")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    console.error("meta_sync_runs insert failed:", stripSecrets(error.message));
    return null;
  }
  return data.id as string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ error: "Unauthorized." }, 401);
  }

  const allowed = await isCallerAllowed(authHeader);
  if (!allowed) return json({ error: "Unauthorized." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Supabase service role is not configured." }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const startedAt = new Date().toISOString();
  const range = await readRange(req);
  if ("error" in range) return json({ error: range.error }, 400);

  const token = Deno.env.get("META_ACCESS_TOKEN")?.trim() ?? "";
  const adAccountId = Deno.env.get("META_AD_ACCOUNT_ID")?.trim() ?? "";
  if (!token || !/^act_\d+$/.test(adAccountId)) {
    const message = "Meta ad account credentials are not configured.";
    const runId = await recordRun(admin, {
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      status: "error",
      date_from: range.dateFrom,
      date_to: range.dateTo,
      rows_upserted: 0,
      error: message,
    });
    return json({ error: message, run_id: runId }, 500);
  }

  const firstUrl = new URL(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${adAccountId}/insights`
  );
  firstUrl.searchParams.set("level", "ad");
  firstUrl.searchParams.set("time_increment", "1");
  firstUrl.searchParams.set("fields", INSIGHT_FIELDS);
  firstUrl.searchParams.set("time_range", JSON.stringify({ since: range.dateFrom, until: range.dateTo }));
  firstUrl.searchParams.set("limit", "100");
  firstUrl.searchParams.set("access_token", token);

  let rowsUpserted = 0;
  try {
    let nextUrl: string | null = firstUrl.toString();
    let page = 0;
    const syncedAt = new Date().toISOString();
    while (nextUrl) {
      page += 1;
      if (page > MAX_PAGES) throw new Error("Meta insights paging exceeded the page limit.");
      const pageResult = await fetchInsightsPage(nextUrl);
      const mapped = pageResult.data
        .map((row) => toSpendRow(row, adAccountId, syncedAt))
        .filter((row): row is SpendInsert => row != null);
      if (mapped.length > 0) rowsUpserted += await upsertSpend(admin, mapped);
      nextUrl = pageResult.next;
    }

    const runId = await recordRun(admin, {
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      status: "success",
      date_from: range.dateFrom,
      date_to: range.dateTo,
      rows_upserted: rowsUpserted,
      error: null,
    });

    return json({
      run_id: runId,
      status: "success",
      date_from: range.dateFrom,
      date_to: range.dateTo,
      rows_upserted: rowsUpserted,
    });
  } catch (error) {
    const message = stripSecrets(error instanceof Error ? error.message : "Meta sync failed.");
    console.error("meta-ads-sync failed:", message);
    const runId = await recordRun(admin, {
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      status: "error",
      date_from: range.dateFrom,
      date_to: range.dateTo,
      rows_upserted: rowsUpserted,
      error: message,
    });
    return json(
      {
        run_id: runId,
        status: "error",
        date_from: range.dateFrom,
        date_to: range.dateTo,
        rows_upserted: rowsUpserted,
        error: message,
      },
      500
    );
  }
});
