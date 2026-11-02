/**
 * Check cohort sign-ups from yesterday and identify any issues.
 *
 * Usage: npx tsx scripts/check-cohort-signups.ts [YYYY-MM-DD]
 *
 * If no date is provided, defaults to yesterday.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getDisplayName } from "../src/lib/profile/display-name";
import {
  computeAppOnboardingMilestones,
  appOnboardingProgress,
  isProfileFilledForAppOnboarding,
} from "../src/lib/admin/app-onboarding/milestones";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch (error) {
    console.log("No .env.local file found, using environment variables");
  }
}

function getTargetDate(): string {
  const providedDate = process.argv[2];
  if (providedDate) {
    return providedDate;
  }
  
  // Default to yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0];
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const targetDate = getTargetDate();
  const startOfDay = `${targetDate}T00:00:00`;
  const endOfDay = `${targetDate}T23:59:59`;

  console.log(`\n🔍 Checking cohort sign-ups for ${targetDate}\n`);

  // Query student_packages created on target date for packages with live sessions (cohorts)
  const { data: studentPackages, error: spError } = await supabase
    .from("student_packages")
    .select(
      `
      id,
      user_id,
      status,
      package_id,
      course_id,
      enrollment_id,
      purchased_at,
      packages(
        name,
        slug,
        delivery_mode,
        includes_live_sessions
      ),
      courses(name)
    `
    )
    .gte("purchased_at", startOfDay)
    .lte("purchased_at", endOfDay);

  if (spError) {
    console.error("Error fetching student packages:", spError.message);
    return;
  }

  if (!studentPackages || studentPackages.length === 0) {
    console.log("❌ No sign-ups found for this date.");
    return;
  }

  // Filter for cohort packages (group delivery with live sessions)
  const cohortPackages = studentPackages.filter((sp) => {
    const pkg = Array.isArray(sp.packages) ? sp.packages[0] : sp.packages;
    return pkg?.delivery_mode === "group" && pkg?.includes_live_sessions === true;
  });

  if (cohortPackages.length === 0) {
    console.log("❌ No cohort sign-ups found for this date.");
    console.log(`   Found ${studentPackages.length} sign-up(s), but none were for group cohorts.`);
    return;
  }

  console.log(`✅ Found ${cohortPackages.length} cohort sign-up(s)\n`);

  // Get user IDs
  const userIds = [...new Set(cohortPackages.map((sp) => sp.user_id))];

  // Load auth users
  const { data: authData } = await supabase.auth.admin.listUsers();
  const authUsers = authData?.users ?? [];
  const authUserById = new Map(authUsers.map((user) => [user.id, user]));

  // Load profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, full_name, preferred_name, avatar_url, placement_completed_at, learner_level, created_at"
    )
    .in("id", userIds);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  // Load onboarding checklists
  const { data: checklists } = await supabase
    .from("onboarding_checklists")
    .select("*")
    .in(
      "student_package_id",
      cohortPackages.map((sp) => sp.id)
    );

  const checklistByPackageId = new Map((checklists ?? []).map((c) => [c.student_package_id, c]));

  // Load enrollments to find cohort assignments
  const enrollmentIds = cohortPackages
    .map((sp) => sp.enrollment_id)
    .filter((id): id is string => Boolean(id));

  let enrollmentById = new Map();
  if (enrollmentIds.length > 0) {
    const { data: enrollments } = await supabase
      .from("course_enrollments")
      .select("id, cohort_id, cohorts(id, name)")
      .in("id", enrollmentIds);

    enrollmentById = new Map((enrollments ?? []).map((e) => [e.id, e]));
  }

  // Check for practice activity
  const practicedIds = new Set<string>();
  if (userIds.length > 0) {
    const [{ data: gameRows }, { data: quizRows }, { data: masteryRows }] = await Promise.all([
      supabase.from("game_scores").select("user_id").in("user_id", userIds),
      supabase.from("quiz_progress").select("user_id").in("user_id", userIds),
      supabase
        .from("topic_mastery")
        .select("user_id, mastery_level, depth")
        .in("user_id", userIds),
    ]);

    for (const row of gameRows ?? []) practicedIds.add(row.user_id as string);
    for (const row of quizRows ?? []) practicedIds.add(row.user_id as string);
    for (const row of masteryRows ?? []) {
      const masteryLevel = Number(row.mastery_level) || 0;
      const depth = Number(row.depth) || 0;
      if (masteryLevel > 0 || depth > 0) {
        practicedIds.add(row.user_id as string);
      }
    }
  }

  // Display results for each sign-up
  for (const sp of cohortPackages) {
    const pkg = Array.isArray(sp.packages) ? sp.packages[0] : sp.packages;
    const course = Array.isArray(sp.courses) ? sp.courses[0] : sp.courses;
    const profile = profileById.get(sp.user_id);
    const authUser = authUserById.get(sp.user_id);
    const checklist = checklistByPackageId.get(sp.id);

    const displayName = getDisplayName(profile ?? null) ?? authUser?.email ?? sp.user_id.slice(0, 8);
    const email = authUser?.email ?? "Unknown email";

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`👤 ${displayName}`);
    console.log(`   📧 ${email}`);
    console.log(`   📦 ${pkg?.name ?? "Unknown package"} (${course?.name ?? "Unknown course"})`);
    console.log(`   📅 Signed up: ${new Date(sp.purchased_at).toLocaleString()}`);
    console.log(`   💳 Status: ${sp.status}`);

    // Check cohort assignment
    if (sp.enrollment_id) {
      const enrollment = enrollmentById.get(sp.enrollment_id);
      const cohortRaw = Array.isArray(enrollment?.cohorts)
        ? enrollment.cohorts[0]
        : enrollment?.cohorts;
      if (cohortRaw) {
        console.log(`   🎓 Cohort: ${cohortRaw.name}`);
      } else {
        console.log(`   ⚠️  Cohort: Not assigned yet`);
      }
    } else {
      console.log(`   ⚠️  Cohort: Not assigned yet`);
    }

    // Check app onboarding milestones
    const profileSnapshot = profile ?? {
      full_name: null,
      preferred_name: null,
      avatar_url: null,
      placement_completed_at: null,
    };

    const milestones = computeAppOnboardingMilestones({
      hasAccount: Boolean(authUser),
      emailConfirmedAt: authUser?.email_confirmed_at,
      profile: profileSnapshot,
      practiced: practicedIds.has(sp.user_id),
    });

    const { done, total } = appOnboardingProgress(milestones);

    console.log(`\n   📊 App Onboarding Progress: ${done}/${total}`);
    console.log(`      ${milestones.signedUp ? "✅" : "❌"} Account created`);
    console.log(`      ${milestones.emailConfirmed ? "✅" : "⚠️ "} Email confirmed`);
    console.log(`      ${milestones.profileFilled ? "✅" : "⚠️ "} Profile filled`);
    console.log(`      ${milestones.placementDone ? "✅" : "⚠️ "} Placement test completed`);
    console.log(`      ${milestones.practiced ? "✅" : "⚠️ "} Practice activity recorded`);

    // Check package onboarding checklist
    if (checklist) {
      const checklistDone = [
        checklist.time_assigned,
        checklist.welcome_email,
        checklist.calendar_invite,
        checklist.tutor_notified,
        checklist.package_created,
        checklist.whatsapp_chat_made,
        checklist.schedule_whatsapp_chat,
      ].filter(Boolean).length;

      const checklistTotal = 7;
      console.log(`\n   📋 Package Onboarding Checklist: ${checklistDone}/${checklistTotal}`);
      console.log(`      ${checklist.time_assigned ? "✅" : "⚠️ "} Time assigned`);
      console.log(`      ${checklist.welcome_email ? "✅" : "⚠️ "} Welcome email sent`);
      console.log(`      ${checklist.calendar_invite ? "✅" : "⚠️ "} Calendar invite sent`);
      console.log(`      ${checklist.tutor_notified ? "✅" : "⚠️ "} Tutor notified`);
      console.log(`      ${checklist.package_created ? "✅" : "⚠️ "} Package created`);
      console.log(`      ${checklist.whatsapp_chat_made ? "✅" : "⚠️ "} WhatsApp chat created`);
      console.log(
        `      ${checklist.schedule_whatsapp_chat ? "✅" : "⚠️ "} WhatsApp chat scheduled`
      );
      console.log(
        `      ${checklist.onboarding_completed ? "✅" : "⚠️ "} Onboarding marked complete`
      );
    } else {
      console.log(`\n   ⚠️  Package Onboarding Checklist: Not created yet`);
    }

    // Summary of issues
    const issues: string[] = [];
    if (!milestones.emailConfirmed) issues.push("Email not confirmed");
    if (!milestones.profileFilled) issues.push("Profile incomplete");
    if (!milestones.placementDone) issues.push("Placement test not done");
    if (!milestones.practiced) issues.push("No practice activity");
    if (!sp.enrollment_id) issues.push("Not assigned to cohort");
    if (!checklist) issues.push("Package onboarding checklist not created");

    if (issues.length > 0) {
      console.log(`\n   ⚠️  Issues Found:`);
      for (const issue of issues) {
        console.log(`      • ${issue}`);
      }
    } else {
      console.log(`\n   ✅ No issues - everything looks good!`);
    }

    console.log("");
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`📈 Summary:`);
  console.log(`   Total cohort sign-ups: ${cohortPackages.length}`);

  const usersWithIssues = cohortPackages.filter((sp) => {
    const profile = profileById.get(sp.user_id);
    const authUser = authUserById.get(sp.user_id);
    const checklist = checklistByPackageId.get(sp.id);

    const profileSnapshot = profile ?? {
      full_name: null,
      preferred_name: null,
      avatar_url: null,
      placement_completed_at: null,
    };

    const milestones = computeAppOnboardingMilestones({
      hasAccount: Boolean(authUser),
      emailConfirmedAt: authUser?.email_confirmed_at,
      profile: profileSnapshot,
      practiced: practicedIds.has(sp.user_id),
    });

    return (
      !milestones.emailConfirmed ||
      !milestones.profileFilled ||
      !milestones.placementDone ||
      !milestones.practiced ||
      !sp.enrollment_id ||
      !checklist
    );
  }).length;

  console.log(`   Users with issues: ${usersWithIssues}`);
  console.log(`   Users without issues: ${cohortPackages.length - usersWithIssues}`);
  console.log("");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
