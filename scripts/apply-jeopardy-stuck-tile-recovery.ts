/**
 * Apply Jeopardy stuck-tile recovery migration.
 *
 *   node --env-file=.env.local --import tsx scripts/apply-jeopardy-stuck-tile-recovery.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF = "pztubczhqkzcwtkstpgi";

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("SUPABASE_ACCESS_TOKEN is required.");
  }

  const sql = readFileSync(
    resolve(process.cwd(), "supabase/jeopardy-stuck-tile-recovery.sql"),
    "utf8"
  );
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Migration failed (${response.status}): ${body.slice(0, 1200)}`);
  }

  console.log("Applied supabase/jeopardy-stuck-tile-recovery.sql");
  console.log(body.slice(0, 500));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
