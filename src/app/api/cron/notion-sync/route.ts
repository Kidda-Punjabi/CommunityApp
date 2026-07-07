import { ensureLeadsAppUserIdProperty } from "@/lib/notion/client";
import { linkLeadsFromNotion } from "@/lib/notion/lead-sync";
import { pullPackageInstancesFromNotion } from "@/lib/notion/package-sync";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
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

  let leadsSetupError: string | null = null;
  try {
    await ensureLeadsAppUserIdProperty();
  } catch (error) {
    leadsSetupError =
      error instanceof Error ? error.message : "Failed to ensure Leads App User ID property.";
  }

  const [packages, leads] = await Promise.all([
    pullPackageInstancesFromNotion(client),
    linkLeadsFromNotion(client),
  ]);

  return NextResponse.json({
    packages,
    leads,
    leadsSetupError,
  });
}
