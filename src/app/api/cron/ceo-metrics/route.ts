import { refreshCeoMetrics } from "@/lib/admin/ceo/refresh";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { NextResponse } from "next/server";

export const maxDuration = 300;

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
  const inWindow = hour === 4 && minute >= 10 && minute <= 25;
  if (url.searchParams.get("force") !== "1" && !inWindow) {
    return NextResponse.json({
      skipped: true,
      reason: "Outside the 04:15 Europe/London window. Meta spend sync runs at 03:15.",
    });
  }

  const { client, error: configError } = tryCreateServiceRoleClient();
  if (!client) return NextResponse.json({ error: configError }, { status: 500 });

  try {
    const snapshot = await refreshCeoMetrics(client);
    return NextResponse.json({
      ok: true,
      snapshotDate: snapshot.snapshotDate,
      periodStart: snapshot.periodStart,
      periodEnd: snapshot.periodEnd,
      notConnected: snapshot.metrics.filter((metric) => metric.status === "not_connected").map((metric) => metric.id),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "CEO metrics refresh failed." },
      { status: 500 }
    );
  }
}
