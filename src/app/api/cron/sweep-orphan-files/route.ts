import { runOrphanFileSweep } from "@/lib/storage/sweep-orphan-files";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { NextResponse } from "next/server";

export const maxDuration = 60;

// 02:30 UTC is 03:30 BST. 03:30 UTC is 03:30 GMT. The handler runs only inside that UK window.

function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const { client, error: configError } = tryCreateServiceRoleClient();
  if (!client) return NextResponse.json({ error: configError }, { status: 500 });

  try {
    const result = await runOrphanFileSweep(client, { force: url.searchParams.get("force") === "1" });
    return NextResponse.json({ ok: result.status !== "failed", ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "File sweep failed." },
      { status: 500 }
    );
  }
}
