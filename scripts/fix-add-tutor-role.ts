/**
 * Fix script for adding tutor role to a user
 * 
 * Usage: tsx scripts/fix-add-tutor-role.ts <tutor-email-or-name>
 * Example: tsx scripts/fix-add-tutor-role.ts osh@example.com
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

async function findUser(searchTerm: string) {
  console.log(`\n🔍 Searching for user: "${searchTerm}"\n`);

  const { data: profiles, error } = await adminClient
    .from("profiles")
    .select("id, email, full_name, preferred_name")
    .or(`email.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%,preferred_name.ilike.%${searchTerm}%`)
    .limit(5);

  if (error) {
    console.error("❌ Error searching for user:", error.message);
    return null;
  }

  if (!profiles || profiles.length === 0) {
    console.error("❌ No profiles found matching:", searchTerm);
    return null;
  }

  if (profiles.length === 1) {
    return profiles[0];
  }

  console.log(`⚠️  Found ${profiles.length} matching profiles:\n`);
  profiles.forEach((p, i) => {
    console.log(`${i + 1}. ${p.full_name || p.preferred_name} (${p.email})`);
  });
  console.log("\n❌ Please provide a more specific search term\n");
  return null;
}

async function addTutorRole(userId: string, userName: string) {
  console.log(`\n📝 Adding tutor role to ${userName}...\n`);

  // Check current roles
  const { data: currentRoles } = await adminClient
    .from("profile_roles")
    .select("role")
    .eq("user_id", userId);

  console.log(`Current roles: ${currentRoles?.map((r) => r.role).join(", ") || "none"}`);

  const hasTutorRole = currentRoles?.some(
    (r) => r.role === "tutor" || r.role === "master_admin"
  );

  if (hasTutorRole) {
    console.log("\n✅ User already has tutor access (tutor or master_admin role)\n");
    return true;
  }

  // Add tutor role
  const { error } = await adminClient.from("profile_roles").insert({
    user_id: userId,
    role: "tutor",
  });

  if (error) {
    if (error.code === "23505") {
      // Unique constraint violation - role already exists
      console.log("\n✅ Tutor role already exists (no change needed)\n");
      return true;
    }
    console.error("\n❌ Error adding tutor role:", error.message);
    console.error(error);
    return false;
  }

  console.log("\n✅ Successfully added tutor role!\n");
  console.log("Next steps:");
  console.log("1. Have the tutor refresh their browser");
  console.log("2. Navigate to /dashboard/tutor/calendar");
  console.log("3. If not connected, click 'Connect Google Calendar'");
  console.log("4. Complete OAuth flow");
  console.log("5. Click 'Sync calendar now'\n");

  return true;
}

async function main() {
  const searchTerm = process.argv[2];

  if (!searchTerm) {
    console.error("\n❌ Usage: tsx scripts/fix-add-tutor-role.ts <email-or-name>\n");
    console.error("Example: tsx scripts/fix-add-tutor-role.ts osh@example.com");
    console.error("Example: tsx scripts/fix-add-tutor-role.ts Osh\n");
    process.exit(1);
  }

  console.log("\n" + "=".repeat(70));
  console.log("  🔧 Add Tutor Role Tool");
  console.log("=".repeat(70));

  const user = await findUser(searchTerm);
  if (!user) {
    process.exit(1);
  }

  console.log("✅ Found user:");
  console.log(`   ID: ${user.id}`);
  console.log(`   Name: ${user.full_name || user.preferred_name || "N/A"}`);
  console.log(`   Email: ${user.email}`);

  const success = await addTutorRole(user.id, user.full_name || user.email);

  console.log("=".repeat(70) + "\n");

  process.exit(success ? 0 : 1);
}

main().catch((error) => {
  console.error("\n❌ Unexpected error:", error);
  process.exit(1);
});
