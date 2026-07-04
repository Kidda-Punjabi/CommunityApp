/**
 * Bulk-approve pending comprehension sentence audio.
 *
 * Usage:
 *   npx tsx scripts/approve-comprehension-audio-batch.ts
 *   npx tsx scripts/approve-comprehension-audio-batch.ts --limit=50
 *   npx tsx scripts/approve-comprehension-audio-batch.ts --reviewer-id=<uuid>
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { approveContentAudio } from "../src/lib/audio/generate-audio";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;

  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit?.slice(prefix.length);
}

async function resolveReviewerId(
  supabase: ReturnType<typeof createClient>
): Promise<string | null> {
  const fromArg = argValue("reviewer-id");
  if (fromArg) return fromArg;

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .in("app_role", ["master_admin", "community_lead"])
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("Could not load reviewer profile:", error.message);
    return null;
  }

  return data?.id ?? null;
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const limit = Math.max(1, parseInt(argValue("limit") ?? "99999", 10));

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const reviewerId = await resolveReviewerId(supabase);
  if (!reviewerId) {
    console.error(
      "No reviewer ID — pass --reviewer-id=<your-profile-uuid> or ensure an admin profile exists."
    );
    process.exit(1);
  }

  const { data: assets, error } = await supabase
    .from("audio_assets")
    .select("content_id, status")
    .eq("content_type", "comprehension_sentence")
    .eq("status", "pending_review")
    .order("updated_at", { ascending: true });

  if (error) {
    console.error("Failed to load pending assets:", error.message);
    process.exit(1);
  }

  const queue = (assets ?? []).slice(0, limit);
  console.log(`Found ${assets?.length ?? 0} pending comprehension clip(s); approving ${queue.length}.`);

  if (queue.length === 0) {
    return;
  }

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < queue.length; i += 1) {
    const contentId = queue[i].content_id as string;
    const result = await approveContentAudio(
      supabase,
      "comprehension_sentence",
      contentId,
      reviewerId
    );

    if (!result.ok) {
      fail += 1;
      console.log(`  FAIL  [${i + 1}/${queue.length}] ${contentId}: ${result.error}`);
      continue;
    }

    ok += 1;
    if ((i + 1) % 25 === 0 || i + 1 === queue.length) {
      console.log(`  OK    ${i + 1}/${queue.length} approved…`);
    }
  }

  console.log(`\nSummary: ${ok} approved, ${fail} failed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
