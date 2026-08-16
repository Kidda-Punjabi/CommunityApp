/**
 * Apply per-kid XP and streak schema.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=... npx tsx scripts/apply-kid-profile-xp-streaks.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF = "pztubczhqkzcwtkstpgi";
const FILENAME = "supabase/kid-profile-xp-streaks.sql";

async function runSql(query: string, label: string) {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("SUPABASE_ACCESS_TOKEN is required to apply migrations.");
  }

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${label} failed (${response.status}): ${body.slice(0, 2000)}`);
  }
  return body;
}

async function main() {
  const sql = readFileSync(resolve(process.cwd(), FILENAME), "utf8");
  await runSql(sql, FILENAME);
  console.log(`Applied ${FILENAME}`);

  const check = await runSql(
    `
    SELECT
      (SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'kid_profiles' AND column_name = 'total_xp') AS kid_total_xp,
      (SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_streaks' AND column_name = 'kid_profile_id') AS streak_kid_col,
      (SELECT COUNT(*) FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'kid_lesson_xp_awarded') AS kid_lesson_xp_table;
    `,
    "post-apply column check"
  );
  console.log(check);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
