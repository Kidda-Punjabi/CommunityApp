/**
 * Diagnostic script for tutor calendar sync issues
 * 
 * Usage: tsx scripts/diagnose-calendar-sync.ts <tutor-email-or-name>
 * Example: tsx scripts/diagnose-calendar-sync.ts osh@example.com
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

interface DiagnosticResult {
  success: boolean;
  issue?: string;
  details?: unknown;
  fix?: string;
}

async function findTutor(searchTerm: string) {
  console.log(`\n🔍 Searching for tutor: "${searchTerm}"\n`);

  const { data: profiles, error } = await adminClient
    .from("profiles")
    .select("id, email, full_name, preferred_name, created_at")
    .or(`email.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%,preferred_name.ilike.%${searchTerm}%`)
    .limit(5);

  if (error) {
    console.error("❌ Error searching for tutor:", error.message);
    return null;
  }

  if (!profiles || profiles.length === 0) {
    console.error("❌ No profiles found matching:", searchTerm);
    return null;
  }

  if (profiles.length === 1) {
    const tutor = profiles[0];
    console.log("✅ Found tutor:");
    console.log(`   ID: ${tutor.id}`);
    console.log(`   Name: ${tutor.full_name || tutor.preferred_name || "N/A"}`);
    console.log(`   Email: ${tutor.email}`);
    console.log(`   Created: ${tutor.created_at}\n`);
    return tutor;
  }

  console.log(`⚠️  Found ${profiles.length} matching profiles:\n`);
  profiles.forEach((p, i) => {
    console.log(`${i + 1}. ${p.full_name || p.preferred_name} (${p.email})`);
  });
  console.log("\n❌ Please provide a more specific search term\n");
  return null;
}

async function checkTutorRole(userId: string): Promise<DiagnosticResult> {
  console.log("📋 Checking tutor role...");

  const { data: roles, error } = await adminClient
    .from("profile_roles")
    .select("role, granted_at")
    .eq("user_id", userId);

  if (error) {
    return {
      success: false,
      issue: "Database error checking roles",
      details: error.message,
    };
  }

  const hasTutorRole = roles?.some((r) => r.role === "tutor" || r.role === "master_admin");

  if (!hasTutorRole) {
    return {
      success: false,
      issue: "Missing tutor role",
      details: { currentRoles: roles?.map((r) => r.role) || [] },
      fix: `Run this SQL to add tutor role:\n\nINSERT INTO profile_roles (user_id, role)\nVALUES ('${userId}', 'tutor'::app_role)\nON CONFLICT (user_id, role) DO NOTHING;`,
    };
  }

  console.log("   ✅ Has tutor role");
  console.log(`   Roles: ${roles.map((r) => r.role).join(", ")}\n`);

  return { success: true };
}

async function checkCalendarConnection(userId: string): Promise<DiagnosticResult> {
  console.log("🔗 Checking Google Calendar connection...");

  const { data: connection, error } = await adminClient
    .from("tutor_google_calendar_connections")
    .select("*")
    .eq("tutor_id", userId)
    .maybeSingle();

  if (error) {
    return {
      success: false,
      issue: "Database error checking connection",
      details: error.message,
    };
  }

  if (!connection) {
    return {
      success: false,
      issue: "Calendar not connected",
      fix: "Tutor needs to connect their Google Calendar:\n1. Go to /dashboard/tutor/calendar\n2. Click 'Connect Google Calendar'\n3. Complete OAuth flow",
    };
  }

  const tokenExpiresAt = new Date(connection.token_expires_at);
  const isTokenValid = tokenExpiresAt > new Date();
  const lastSynced = connection.last_synced_at
    ? new Date(connection.last_synced_at)
    : null;

  console.log("   ✅ Calendar connected");
  console.log(`   Account: ${connection.google_account_email}`);
  console.log(`   Calendar ID: ${connection.calendar_id}`);
  console.log(`   Connected: ${new Date(connection.connected_at).toLocaleString()}`);
  console.log(`   Last synced: ${lastSynced ? lastSynced.toLocaleString() : "Never"}`);
  console.log(`   Token expires: ${tokenExpiresAt.toLocaleString()}`);
  console.log(`   Token status: ${isTokenValid ? "✅ Valid" : "⚠️  Expired"}\n`);

  if (!isTokenValid) {
    return {
      success: false,
      issue: "Access token expired",
      details: { tokenExpiresAt: connection.token_expires_at },
      fix: "Token will auto-refresh on next sync attempt, or tutor can disconnect and reconnect calendar",
    };
  }

  return { success: true, details: connection };
}

async function checkRecentSessions(userId: string): Promise<DiagnosticResult> {
  console.log("📅 Checking synced sessions...");

  const { data: sessions, error } = await adminClient
    .from("tutor_scheduled_sessions")
    .select("id, title, starts_at, status, match_method, created_at")
    .eq("tutor_id", userId)
    .order("starts_at", { ascending: false })
    .limit(5);

  if (error) {
    return {
      success: false,
      issue: "Database error checking sessions",
      details: error.message,
    };
  }

  if (!sessions || sessions.length === 0) {
    console.log("   ⚠️  No synced sessions found");
    console.log("   This could mean:");
    console.log("   - Calendar has no events in sync range (last 90 days to next 540 days)");
    console.log("   - Sync hasn't run yet");
    console.log("   - No events matched students/cohorts\n");
    return { success: true, details: { sessionCount: 0 } };
  }

  console.log(`   ✅ Found ${sessions.length} recent sessions (showing up to 5):`);
  sessions.forEach((s) => {
    console.log(`   - ${s.title} (${new Date(s.starts_at).toLocaleString()})`);
    console.log(`     Status: ${s.status}, Match: ${s.match_method}`);
  });
  console.log();

  return { success: true, details: { sessionCount: sessions.length } };
}

async function checkOAuthConfig(): Promise<DiagnosticResult> {
  console.log("🔐 Checking OAuth configuration...");

  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

  const issues: string[] = [];

  if (!clientId) issues.push("Missing GOOGLE_CALENDAR_CLIENT_ID");
  if (!clientSecret) issues.push("Missing GOOGLE_CALENDAR_CLIENT_SECRET");

  if (issues.length > 0) {
    console.log("   ❌ OAuth not configured properly");
    issues.forEach((issue) => console.log(`   - ${issue}`));
    console.log();
    return {
      success: false,
      issue: "OAuth configuration incomplete",
      details: issues,
      fix: "Set required environment variables in production environment",
    };
  }

  console.log("   ✅ OAuth client ID configured");
  console.log("   ✅ OAuth client secret configured");
  if (redirectUri) {
    console.log(`   ℹ️  Custom redirect URI: ${redirectUri}`);
  } else {
    console.log("   ℹ️  Using default redirect URI: {APP_URL}/api/google/calendar/callback");
  }
  console.log();

  return { success: true };
}

async function runDiagnostics(tutorSearch: string) {
  console.log("\n" + "=".repeat(70));
  console.log("  📊 Calendar Sync Diagnostic Tool");
  console.log("=".repeat(70));

  const tutor = await findTutor(tutorSearch);
  if (!tutor) {
    process.exit(1);
  }

  const results: Record<string, DiagnosticResult> = {};

  // Check OAuth config first (system-wide)
  results.oauth = await checkOAuthConfig();

  // Check tutor-specific items
  results.role = await checkTutorRole(tutor.id);
  results.connection = await checkCalendarConnection(tutor.id);
  results.sessions = await checkRecentSessions(tutor.id);

  // Summary
  console.log("=".repeat(70));
  console.log("  📋 DIAGNOSTIC SUMMARY");
  console.log("=".repeat(70) + "\n");

  const allSuccess = Object.values(results).every((r) => r.success);

  if (allSuccess) {
    console.log("✅ All checks passed! Calendar sync should be working.\n");
    console.log("If sync is still failing, check:");
    console.log("- Application logs for specific error messages");
    console.log("- Google Cloud Console: Calendar API is enabled");
    console.log("- OAuth consent screen has correct scopes");
    console.log("- Tutor can manually click 'Sync calendar now' button\n");
  } else {
    console.log("⚠️  Issues found:\n");

    Object.entries(results).forEach(([check, result]) => {
      if (!result.success) {
        console.log(`❌ ${check.toUpperCase()}: ${result.issue}`);
        if (result.details) {
          console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
        }
        if (result.fix) {
          console.log(`\n   💡 Fix:\n   ${result.fix.split("\n").join("\n   ")}\n`);
        }
      }
    });
  }

  console.log("=".repeat(70) + "\n");

  process.exit(allSuccess ? 0 : 1);
}

// Main
const tutorSearch = process.argv[2];

if (!tutorSearch) {
  console.error("\n❌ Usage: tsx scripts/diagnose-calendar-sync.ts <tutor-email-or-name>\n");
  console.error("Example: tsx scripts/diagnose-calendar-sync.ts osh@example.com");
  console.error("Example: tsx scripts/diagnose-calendar-sync.ts Osh\n");
  process.exit(1);
}

runDiagnostics(tutorSearch).catch((error) => {
  console.error("\n❌ Unexpected error:", error);
  process.exit(1);
});
