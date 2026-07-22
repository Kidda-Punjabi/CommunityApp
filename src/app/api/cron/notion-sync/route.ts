import { ensureLeadSourceAppSignupOption, ensureLeadsAppUserIdProperty } from "@/lib/notion/client";
import {
  linkUnlinkedProfilesFromApp,
  upsertNotionLeadsCache,
} from "@/lib/notion/lead-sync";
import { pullLessonLogFromNotion } from "@/lib/notion/lesson-log-sync";
import { pullPackageInstancesFromNotion } from "@/lib/notion/package-sync";
import { syncAllGroupCohortsFromNotion } from "@/lib/notion/sync-group-cohorts-for-checkout";
import { pullSalesCallsFromNotion } from "@/lib/notion/sales-call-sync";
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
    await ensureLeadSourceAppSignupOption();
  } catch (error) {
    leadsSetupError =
      error instanceof Error ? error.message : "Failed to ensure Leads Notion schema.";
  }

  const url = new URL(request.url);
  const fullSalesCallSync = url.searchParams.get("fullSalesCallSync") === "1";
  const fullLeadsCacheSync = url.searchParams.get("fullLeadsCacheSync") === "1";
  const fullLessonLogSync = url.searchParams.get("fullLessonLogSync") === "1";

  const [packages, groupCohorts, leadsCache, salesCalls, lessonLog] = await Promise.all([
    pullPackageInstancesFromNotion(client),
    syncAllGroupCohortsFromNotion(client),
    upsertNotionLeadsCache(client, { fullSync: fullLeadsCacheSync }),
    pullSalesCallsFromNotion(client, { fullSync: fullSalesCallSync }),
    pullLessonLogFromNotion(client, { fullSync: fullLessonLogSync }).catch((error) => ({
      pulled: 0,
      skipped: 0,
      errors: [error instanceof Error ? error.message : "Lesson log pull failed."],
    })),
  ]);

  const profileLeads = await linkUnlinkedProfilesFromApp(client);

  return NextResponse.json({
    packages,
    groupCohorts,
    profileLeads,
    leadsCache,
    salesCalls,
    lessonLog,
    leadsSetupError,
  });
}
