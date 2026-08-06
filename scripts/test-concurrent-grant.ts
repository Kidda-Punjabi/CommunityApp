/**
 * Test script to simulate concurrent signups and verify grant reliability
 * 
 * Usage: tsx scripts/test-concurrent-grant.ts
 * 
 * This script:
 * 1. Creates test profiles (or reuses existing)
 * 2. Links them to Notion leads with valid package relations
 * 3. Runs grants concurrently (simulating real signup load)
 * 4. Verifies all grants succeeded or were queued
 * 5. Reports any silent failures
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase configuration");
  console.error("Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

type TestProfile = {
  id: string;
  email: string;
  leadPageId: string;
};

async function findTestProfiles(count: number): Promise<TestProfile[]> {
  // Find profiles that have notion_lead_page_id and can be used for testing
  const { data: profiles, error } = await adminClient
    .from("profiles")
    .select("id, email, notion_lead_page_id")
    .not("notion_lead_page_id", "is", null)
    .limit(count);

  if (error) {
    console.error("Error finding test profiles:", error.message);
    return [];
  }

  return (profiles ?? []).map((p) => ({
    id: p.id,
    email: p.email ?? `test-${p.id}@example.com`,
    leadPageId: p.notion_lead_page_id!,
  }));
}

async function runConcurrentGrants(profiles: TestProfile[]) {
  console.log(`\n🚀 Running ${profiles.length} concurrent grants...`);
  console.log(`Start time: ${new Date().toISOString()}\n`);

  const { grantAccessFromLinkedLeadPackages } = await import(
    "../src/lib/notion/lead-purchase-access-grant"
  );

  const startTime = Date.now();
  
  // Run all grants concurrently to simulate real load
  const results = await Promise.allSettled(
    profiles.map((profile) =>
      grantAccessFromLinkedLeadPackages(adminClient, profile.id, profile.leadPageId)
    )
  );

  const elapsed = Date.now() - startTime;
  console.log(`\n✅ All grants completed in ${elapsed}ms\n`);

  return results.map((result, i) => ({
    profile: profiles[i]!,
    status: result.status,
    result: result.status === "fulfilled" ? result.value : null,
    error: result.status === "rejected" ? result.reason : null,
  }));
}

async function verifyResults(
  results: Array<{
    profile: TestProfile;
    status: string;
    result: unknown;
    error: unknown;
  }>
) {
  console.log("\n📊 RESULTS SUMMARY\n");
  console.log("=".repeat(70));

  let granted = 0;
  let queued = 0;
  let skipped = 0;
  let silentFailures = 0;

  for (const { profile, status, result, error } of results) {
    if (status === "rejected") {
      console.log(`❌ ${profile.email} - REJECTED:`, error);
      silentFailures++;
      continue;
    }

    const r = result as {
      granted: number;
      queued: number;
      skipped: number;
      errors: string[];
    };

    if (r.granted === 1) {
      console.log(`✅ ${profile.email} - GRANTED`);
      granted++;
    } else if (r.queued === 1) {
      console.log(`📋 ${profile.email} - QUEUED (${r.errors[0] ?? "unknown"})`);
      queued++;
    } else if (r.skipped === 1) {
      console.log(`⏭️  ${profile.email} - SKIPPED (no packages)`);
      skipped++;
    } else if (r.errors.length > 0) {
      console.log(`❌ ${profile.email} - FAILED: ${r.errors.join(", ")}`);
      silentFailures++;
    } else {
      console.log(`❓ ${profile.email} - UNKNOWN STATE:`, r);
      silentFailures++;
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(`\nGranted: ${granted}`);
  console.log(`Queued: ${queued}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Silent Failures: ${silentFailures}`);

  if (silentFailures > 0) {
    console.log("\n❌ TEST FAILED: Silent failures detected!");
    console.log("Expected: All failures should be queued or have visible errors");
    process.exit(1);
  }

  console.log("\n✅ TEST PASSED: No silent failures detected\n");
}

async function checkQueueForProfiles(profiles: TestProfile[]) {
  console.log("\n🔍 Checking queue for test profiles...\n");

  const { data: queueItems, error } = await adminClient
    .from("notion_lead_purchase_grant_queue")
    .select("profile_id, reason, created_at, resolved")
    .in(
      "profile_id",
      profiles.map((p) => p.id)
    )
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error checking queue:", error.message);
    return;
  }

  if (!queueItems || queueItems.length === 0) {
    console.log("No queue items found for test profiles");
    return;
  }

  console.log(`Found ${queueItems.length} queue items:`);
  for (const item of queueItems) {
    const profile = profiles.find((p) => p.id === item.profile_id);
    console.log(
      `  - ${profile?.email ?? item.profile_id}: ${item.reason} (${item.resolved ? "resolved" : "open"})`
    );
  }
}

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("  🧪 Concurrent Grant Test");
  console.log("=".repeat(70));

  // Find 6 test profiles (same as the real incident count)
  const profiles = await findTestProfiles(6);

  if (profiles.length < 3) {
    console.error(
      "\n❌ Need at least 3 profiles with notion_lead_page_id for testing"
    );
    console.error("Create test profiles first or adjust the test");
    process.exit(1);
  }

  console.log(`\nFound ${profiles.length} test profiles:`);
  profiles.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.email} (${p.id.slice(0, 8)}...)`);
  });

  // Run concurrent grants
  const results = await runConcurrentGrants(profiles);

  // Verify results
  await verifyResults(results);

  // Check queue
  await checkQueueForProfiles(profiles);

  console.log("\n" + "=".repeat(70) + "\n");
}

main().catch((error) => {
  console.error("\n❌ Test script error:", error);
  process.exit(1);
});
