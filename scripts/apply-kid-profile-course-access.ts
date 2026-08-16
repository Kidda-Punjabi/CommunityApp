/**
 * Apply kid profile course access migration.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=... npx tsx scripts/apply-kid-profile-course-access.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF = "pztubczhqkzcwtkstpgi";
const FILENAME = "supabase/add-kid-profile-course-access.sql";

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
    SELECT table_name, column_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'cohort_members', 'course_enrollments', 'profile_course_access',
        'student_packages', 'homework_submissions', 'cohort_lesson_attendance',
        'cohort_lesson_homework', 'lesson_progress', 'quiz_progress',
        'course_access', 'student_lesson_unlocks'
      )
      AND column_name IN ('user_id', 'student_id', 'kid_profile_id', 'tutor_note')
    ORDER BY table_name, column_name;
    `,
    "post-apply column check"
  );
  console.log(check);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
