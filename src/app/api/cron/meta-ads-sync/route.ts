import { NextResponse } from "next/server";

export const maxDuration = 300;

/**
 * Nightly Meta spend sync.
 *
 * Vercel cron is UTC-only (same pattern as /api/cron/notion-sync). Two
 * schedules, 02:15 and 03:15 UTC, cover 03:15 Europe/London across BST and GMT.
 * This route runs the sync only when London local time is 03:15.
 */
function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function londonHourMinute(now = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return { hour, minute };
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const { hour, minute } = londonHourMinute();
  const inWindow = hour === 3 && minute >= 10 && minute <= 25;
  if (url.searchParams.get("force") !== "1" && !inWindow) {
    return NextResponse.json({
      skipped: true,
      reason: "Outside the 03:15 Europe/London window.",
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  }

  const body: { date_from?: string; date_to?: string } = {};
  const dateFrom = url.searchParams.get("date_from");
  const dateTo = url.searchParams.get("date_to");
  if (dateFrom) body.date_from = dateFrom;
  if (dateTo) body.date_to = dateTo;

  const response = await fetch(`${supabaseUrl}/functions/v1/meta-ads-sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Meta sync returned a non-JSON response." }, { status: 502 });
  }

  return NextResponse.json(payload, { status: response.ok ? 200 : response.status });
}
