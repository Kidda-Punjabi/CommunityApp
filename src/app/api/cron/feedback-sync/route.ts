import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { pullFeedbackResponsesFromNotion } from "@/lib/notion/feedback-response-sync";
import { NextResponse } from "next/server";

export const maxDuration = 300;

function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { client, error: configError } = tryCreateServiceRoleClient();
  if (!client) {
    return NextResponse.json({ error: configError }, { status: 500 });
  }

  const url = new URL(request.url);
  const fullSync = url.searchParams.get("fullSync") === "1";
  const result = await pullFeedbackResponsesFromNotion(client, { fullSync });
  return NextResponse.json(result);
}
