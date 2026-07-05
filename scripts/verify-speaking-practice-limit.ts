/**
 * Verify Speaking Practice monthly rate limit after running supabase/speaking-practice.sql
 *
 * Usage: npx tsx scripts/verify-speaking-practice-limit.ts [user_id]
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const p = resolve(".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    if (!process.env[k]) {
      process.env[k] = t.slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error("Usage: npx tsx scripts/verify-speaking-practice-limit.ts <user_id>");
    process.exit(1);
  }

  const { error: tableErr } = await admin.from("speaking_practice_attempts").select("id").limit(1);
  if (tableErr) {
    console.error("Run supabase/speaking-practice.sql first:", tableErr.message);
    process.exit(1);
  }

  const monthKey = new Date().toISOString().slice(0, 7);

  await admin
    .from("speaking_practice_attempts")
    .delete()
    .eq("user_id", userId)
    .eq("month_key", monthKey);

  console.log("Testing check_and_increment_speaking_attempt for user", userId);

  for (let i = 1; i <= 61; i += 1) {
    const { data, error } = await admin.rpc("check_and_increment_speaking_attempt", {
      p_user_id: userId,
      p_flashcard_id: null,
    });

    if (error) {
      console.error("RPC failed:", error.message);
      process.exit(1);
    }

    const result = data as { allowed: boolean; attempt_count: number; remaining: number };

    if (i <= 60) {
      if (!result.allowed) {
        console.error(`✗ Attempt ${i} blocked early (count=${result.attempt_count})`);
        process.exit(1);
      }
    } else if (result.allowed) {
      console.error(`✗ Attempt 61 was allowed (count=${result.attempt_count})`);
      process.exit(1);
    } else {
      console.log(`✓ Attempt 61 blocked (count=${result.attempt_count}, remaining=${result.remaining})`);
    }
  }

  await admin
    .from("speaking_practice_attempts")
    .delete()
    .eq("user_id", userId)
    .eq("month_key", monthKey);

  console.log("Rate limit verification passed. Cleaned up test row.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
