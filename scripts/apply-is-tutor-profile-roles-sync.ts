/**
 * Apply is_tutor() + profile_roles → app_role sync migration.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=... npx tsx scripts/apply-is-tutor-profile-roles-sync.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF = "pztubczhqkzcwtkstpgi";
const FILENAME = "supabase/is-tutor-profile-roles-sync.sql";

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
    throw new Error(`${label} failed (${response.status}): ${body.slice(0, 800)}`);
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
      pg_get_functiondef('public.is_tutor()'::regprocedure) AS is_tutor_def,
      (
        SELECT count(*)::int
        FROM pg_policies
        WHERE qual ILIKE '%is_tutor()%'
           OR with_check ILIKE '%is_tutor()%'
      ) AS policy_count_referencing_is_tutor,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'schemaname', schemaname,
          'tablename', tablename,
          'policyname', policyname
        ) ORDER BY schemaname, tablename, policyname), '[]'::json)
        FROM pg_policies
        WHERE qual ILIKE '%is_tutor()%'
           OR with_check ILIKE '%is_tutor()%'
      ) AS policies,
      EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'profile_roles'
          AND t.tgname = 'trg_sync_app_role_on_tutor_profile_role'
      ) AS trigger_present;
    `,
    "post-apply verification query"
  );
  console.log(check);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
