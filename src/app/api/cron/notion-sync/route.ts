import { processAttendanceHomeworkWriteback } from "@/lib/notion/attendance-homework-writeback";
import { ensureLeadSourceAppSignupOption, ensureLeadsAppUserIdProperty } from "@/lib/notion/client";
import {
  linkUnlinkedProfilesFromApp,
  upsertNotionLeadsCache,
} from "@/lib/notion/lead-sync";
import { pullLessonLogFromNotion } from "@/lib/notion/lesson-log-sync";
import { pullPackageInstancesFromNotion } from "@/lib/notion/package-sync";
import { finishNotionSyncRun, insertNotionSyncRun, stepFromResult } from "@/lib/notion/sync-run";
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

  const startedAt = new Date().toISOString();
  const runId = await insertNotionSyncRun(client, {
    outcome: "running",
    startedAt,
  });

  try {
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

    // Leads cache first: package/cohort pulls can burn most of maxDuration and previously
    // left this job starved for days while Packages roster emails stayed stale.
    const leadsCache = await upsertNotionLeadsCache(client, {
      fullSync: fullLeadsCacheSync,
    });

    // Package/cohort pulls stay sequential — parallel Notion crawls with Lessons Log
    // competed for the same rate limit and left cohort notion_synced_at stale.
    const packages = await pullPackageInstancesFromNotion(client);
    const groupCohorts = await syncAllGroupCohortsFromNotion(client);

    const [salesCalls, lessonLog] = await Promise.all([
      pullSalesCallsFromNotion(client, { fullSync: fullSalesCallSync }),
      pullLessonLogFromNotion(client, { fullSync: fullLessonLogSync }).catch((error) => ({
        pulled: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : "Lesson log pull failed."],
      })),
    ]);

    const profileLeads = await linkUnlinkedProfilesFromApp(client);

    let writebackThrew = false;
    const attendanceHomeworkWriteback = await processAttendanceHomeworkWriteback(client).catch(
      (error) => {
        const message =
          error instanceof Error ? error.message : "Attendance/homework writeback failed.";
        console.error("[notion-sync] attendanceHomeworkWriteback threw:", message);
        writebackThrew = true;
        return {
          processed: 0,
          sent: 0,
          failed: 0,
          skipped: 0,
          createdLessonLogPages: 0,
          errors: [message],
        };
      }
    );

    const steps = {
      leadsSetupError,
      leadsCache: stepFromResult(leadsCache, {
        upserted: leadsCache.upserted,
        notionPageCount: leadsCache.notionPageCount,
        fullSync: leadsCache.fullSync,
      }),
      packages: stepFromResult(packages, {
        pulled: packages.pulled,
        inboxed: packages.inboxed,
        skipped: packages.skipped,
      }),
      groupCohorts: stepFromResult(groupCohorts, { synced: groupCohorts.synced }),
      salesCalls: stepFromResult(salesCalls, {
        upserted: salesCalls.upserted,
        notionPageCount: salesCalls.notionPageCount,
      }),
      lessonLog: stepFromResult(lessonLog, {
        pulled: lessonLog.pulled,
        skipped: lessonLog.skipped,
      }),
      profileLeads: stepFromResult(profileLeads, {
        processed: profileLeads.processed,
        linked: profileLeads.linked,
        ambiguous: profileLeads.ambiguous,
        conflicts: profileLeads.conflicts,
      }),
      attendanceHomeworkWriteback: stepFromResult(attendanceHomeworkWriteback, {
        processed: attendanceHomeworkWriteback.processed,
        sent: attendanceHomeworkWriteback.sent,
        failed: attendanceHomeworkWriteback.failed,
        skipped: attendanceHomeworkWriteback.skipped,
        createdLessonLogPages: attendanceHomeworkWriteback.createdLessonLogPages,
        threw: writebackThrew,
      }),
    };

    const failed =
      writebackThrew ||
      Object.values(steps).some(
        (step) => step && typeof step === "object" && "ok" in step && step.ok === false
      );

    await finishNotionSyncRun(client, runId, {
      startedAt,
      outcome: failed ? "failed" : "succeeded",
      steps,
      error: leadsSetupError,
    });

    return NextResponse.json({
      packages,
      groupCohorts,
      profileLeads,
      leadsCache,
      salesCalls,
      lessonLog,
      attendanceHomeworkWriteback,
      leadsSetupError,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notion sync failed.";
    console.error("[notion-sync] run threw:", message);
    await finishNotionSyncRun(client, runId, {
      startedAt,
      outcome: "failed",
      steps: {},
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
