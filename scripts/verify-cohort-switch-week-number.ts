/**
 * Verify week_number backfill + cohort switch candidates for cohorts 38–43.
 *
 *   node --env-file=.env.local --import tsx scripts/verify-cohort-switch-week-number.ts
 */
import { createClient } from "@supabase/supabase-js";
import {
  isAlternateCohortSwitchSession,
  resolveCohortSwitchWeekNumber,
} from "../src/lib/calendar/cohort-switch-candidates";

const COHORT_NAME_PATTERNS = ["Cohort 38", "Cohort 39", "Cohort 40", "Cohort 43"];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: cohorts, error: cohortError } = await admin
    .from("cohorts")
    .select("id, name, status, course_id")
    .or(COHORT_NAME_PATTERNS.map((name) => `name.ilike.%${name}%`).join(","))
    .order("name");

  if (cohortError) throw cohortError;

  console.log("\n=== week_number by cohort (upcoming scheduled class sessions) ===");
  for (const cohort of cohorts ?? []) {
    const { data: sessions, error } = await admin
      .from("tutor_scheduled_sessions")
      .select("id, title, starts_at, week_number, status, tutor_id")
      .eq("cohort_id", cohort.id)
      .eq("status", "scheduled")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(8);

    if (error) throw error;

    console.log(`\nCohort ${cohort.id} (${cohort.name}) status=${cohort.status}`);
    for (const session of sessions ?? []) {
      console.log(
        `  week=${session.week_number ?? "NULL"} starts=${session.starts_at} title=${session.title}`
      );
    }
  }

  const cohort40 = (cohorts ?? []).find((cohort) => /cohort 40/i.test(cohort.name));
  if (cohort40) {
    const { data: sourceSessions } = await admin
      .from("tutor_scheduled_sessions")
      .select("*")
      .eq("cohort_id", cohort40.id)
      .eq("status", "scheduled")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(1);

    const source = sourceSessions?.[0];
    if (source) {
      const sourceWeek = resolveCohortSwitchWeekNumber(source);
      console.log(`\n=== Cohort 40 source session week=${sourceWeek} ===`);

      const { data: candidates } = await admin
        .from("tutor_scheduled_sessions")
        .select("*")
        .eq("course_id", source.course_id)
        .not("cohort_id", "is", null)
        .eq("status", "scheduled")
        .gte("starts_at", new Date().toISOString());

      const matches = (candidates ?? []).filter((candidate) =>
        isAlternateCohortSwitchSession(source, candidate)
      );

      console.log(`Matching alternate sessions (same week, any tutor): ${matches.length}`);
      for (const match of matches) {
        const cohort = (cohorts ?? []).find((row) => row.id === match.cohort_id);
        console.log(
          `  cohort=${match.cohort_id} (${cohort?.name ?? "?"}) status=${cohort?.status ?? "?"} week=${match.week_number} tutor=${match.tutor_id}`
        );
      }
    }
  }

  const cohortIds = (cohorts ?? []).map((cohort) => cohort.id);
  const { data: ambiguous } = await admin
    .from("tutor_scheduled_sessions")
    .select("id, cohort_id, starts_at, title")
    .in("cohort_id", cohortIds.length > 0 ? cohortIds : ["00000000-0000-0000-0000-000000000000"])
    .is("week_number", null)
    .eq("status", "scheduled")
    .gte("starts_at", new Date().toISOString());

  console.log(`\n=== Ambiguous (NULL week_number) upcoming sessions in cohorts 38–43: ${ambiguous?.length ?? 0} ===`);
  for (const row of ambiguous ?? []) {
    console.log(`  id=${row.id} cohort=${row.cohort_id} starts=${row.starts_at}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
