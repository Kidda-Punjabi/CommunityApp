import "server-only";

import {
  formatWeeklySessionTimeLabel,
  isCohortNotionSyncFresh,
} from "@/lib/group-purchase/cohort-picker-display";
import { getCohortCheckoutRemainingSpots } from "@/lib/group-purchase/cohort-capacity";
import { packageSlugForCheckoutKey } from "@/lib/group-purchase/checkout-keys";
import { syncGroupCohortsForCourseFromNotion } from "@/lib/notion/sync-group-cohorts-for-checkout";
import { createClient } from "@/lib/supabase/server";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const checkoutKey = searchParams.get("checkoutKey")?.trim() ?? "";

  if (!checkoutKey) {
    return NextResponse.json({ error: "checkoutKey is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to choose a cohort." }, { status: 401 });
  }

  const slug = await packageSlugForCheckoutKey(checkoutKey);
  if (!slug) {
    return NextResponse.json({ error: "Unknown checkout product." }, { status: 400 });
  }

  const { data: pkg, error: pkgError } = await supabase
    .from("packages")
    .select("id, course_id, delivery_mode")
    .eq("slug", slug)
    .maybeSingle();

  if (pkgError) {
    return NextResponse.json({ error: pkgError.message }, { status: 500 });
  }

  if (!pkg || pkg.delivery_mode !== "group") {
    return NextResponse.json({ cohorts: [] });
  }

  let syncWarning: string | null = null;
  const service = tryCreateServiceRoleClient();
  if (service.client) {
    try {
      const { errors } = await syncGroupCohortsForCourseFromNotion(service.client, pkg.course_id);
      if (errors.length > 0) {
        syncWarning = errors.slice(0, 3).join(" ");
      }
    } catch (e) {
      syncWarning =
        e instanceof Error ? e.message : "Could not refresh cohort availability from Notion.";
    }
  } else {
    syncWarning = service.error;
  }

  const { data: cohorts, error: cohortError } = await supabase
    .from("cohorts")
    .select(
      "id, name, start_date, start_day_of_week, capacity, tutor_id, status, notion_synced_at, weekly_session_start, weekly_session_end, weekly_session_has_time"
    )
    .eq("course_id", pkg.course_id)
    .eq("status", "recruiting")
    .order("start_date", { ascending: true, nullsFirst: false });

  if (cohortError) {
    return NextResponse.json({ error: cohortError.message }, { status: 500 });
  }

  const checkingAvailability: Array<{ id: string; name: string }> = [];

  const rows = await Promise.all(
    (cohorts ?? []).map(async (cohort) => {
      if (!isCohortNotionSyncFresh(cohort.notion_synced_at)) {
        checkingAvailability.push({ id: cohort.id, name: cohort.name });
        return null;
      }

      const capacity = cohort.capacity ?? 7;
      const remaining = await getCohortCheckoutRemainingSpots(supabase, cohort.id, capacity);
      if (remaining <= 0) return null;

      return {
        id: cohort.id,
        name: cohort.name,
        startDate: cohort.start_date,
        startDayOfWeek: cohort.start_day_of_week,
        sessionTimeLabel: formatWeeklySessionTimeLabel(
          cohort.weekly_session_start,
          cohort.weekly_session_end,
          cohort.weekly_session_has_time ?? false
        ),
        remainingSpots: remaining,
        tutorAssigned: Boolean(cohort.tutor_id),
      };
    })
  );

  return NextResponse.json({
    cohorts: rows.filter((row): row is NonNullable<typeof row> => row !== null),
    checkingAvailability,
    syncWarning,
  });
}
