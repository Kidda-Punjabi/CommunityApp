/**
 * Apply chado-pauri-ask-room-audience migration.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=... npx tsx scripts/apply-chado-pauri-ask-room-audience.ts
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
    resolve(process.cwd(), "supabase/chado-pauri-ask-room-audience.sql"),
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
    throw new Error(`Migration failed (${response.status}): ${body.slice(0, 800)}`);
  }

  console.log("Applied supabase/chado-pauri-ask-room-audience.sql");
  console.log(body.slice(0, 300));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
