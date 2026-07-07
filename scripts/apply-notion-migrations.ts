/**
 * Apply Notion sync SQL migrations to Supabase project pztubczhqkzcwtkstpgi.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=... npm run apply-notion-migrations
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF = "pztubczhqkzcwtkstpgi";

async function runSql(filename: string) {
  const sql = readFileSync(resolve(process.cwd(), filename), "utf8");
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
      body: JSON.stringify({ query: sql }),
    }
  );

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${filename} failed (${response.status}): ${body.slice(0, 500)}`);
  }

  console.log(`Applied ${filename}`);
}

async function main() {
  await runSql("supabase/notion-package-sync.sql");
  await runSql("supabase/notion-lead-sync.sql");
  console.log("All Notion migrations applied.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
