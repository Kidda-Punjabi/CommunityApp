/**
 * Apply foundational delivery_mode trigger fix + hello@kidda.app enrollment update.
 *
 *   SUPABASE_ACCESS_TOKEN=... node --import tsx scripts/apply-hello-foundational-delivery-mode.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const PROJECT_REF = "pztubczhqkzcwtkstpgi";
const USER_ID = "b4755c02-e4be-4241-a66f-3d50fe0d33da";
const ENROLLMENT_ID = "db98f36d-66eb-45d4-bb2d-e895b21e60a6";
const TUTOR_ID = "d99dbb59-243b-47ba-880f-b07fa50cc1ed";

async function runManagementSql(filename: string) {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("SUPABASE_ACCESS_TOKEN is required for trigger migration.");
  }

  const sql = readFileSync(resolve(process.cwd(), filename), "utf8");
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
    throw new Error(`SQL failed (${response.status}): ${body.slice(0, 800)}`);
  }
  console.log(`Applied ${filename}`);
}

async function main() {
  await runManagementSql("supabase/one-off/foundational-delivery-mode-one-to-one.sql");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.");
  }

  const admin = createClient(url, serviceKey);
  const { data, error } = await admin
    .from("course_enrollments")
    .update({ delivery_mode: "one_to_one" })
    .eq("id", ENROLLMENT_ID)
    .eq("user_id", USER_ID)
    .eq("tutor_id", TUTOR_ID)
    .select("id, tutor_id, delivery_mode, courses(name)")
    .single();

  if (error) throw error;
  console.log("Enrollment updated:", JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
