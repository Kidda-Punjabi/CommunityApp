/**
 * Re-run week_number refresh for active cohorts using TS logic (post-migration fix-up).
 *
 *   node --env-file=.env.local --import tsx scripts/refresh-cohort-session-week-numbers.ts
 */
import { createClient } from "@supabase/supabase-js";
import { refreshCohortSessionWeekNumbers } from "../src/lib/calendar/cohort-session-week-number";

const COHORT_NAME_PATTERNS = ["Cohort 38", "Cohort 39", "Cohort 40", "Cohort 43"];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: cohorts, error } = await admin
    .from("cohorts")
    .select("id, name")
    .or(COHORT_NAME_PATTERNS.map((name) => `name.ilike.%${name}%`).join(","));

  if (error) throw error;

  const cohortIds = (cohorts ?? []).map((cohort) => cohort.id as string);
  console.log(`Refreshing week_number for ${cohortIds.length} cohorts…`);

  const result = await refreshCohortSessionWeekNumbers(admin, cohortIds);
  console.log(`Updated ${result.updated} class sessions.`);
  console.log(`Ambiguous (NULL) session ids (${result.ambiguousSessionIds.length}):`);
  for (const id of result.ambiguousSessionIds.slice(0, 30)) {
    console.log(`  ${id}`);
  }
  if (result.ambiguousSessionIds.length > 30) {
    console.log(`  … and ${result.ambiguousSessionIds.length - 30} more`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
