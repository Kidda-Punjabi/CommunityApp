import { NextResponse } from "next/server";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";

export const maxDuration = 60;

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

  try {
    const { data, error } = await client.rpc("sweep_stuck_jeopardy_tiles");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, result: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Jeopardy sweep failed." },
      { status: 500 }
    );
  }
}
