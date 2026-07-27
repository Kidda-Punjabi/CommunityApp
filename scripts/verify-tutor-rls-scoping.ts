/**
 * Verify tutor RLS scoping after supabase/tutor-rls-scoping-fixes.sql
 *
 *   node --env-file=.env.local --import tsx scripts/verify-tutor-rls-scoping.ts
 *
 * Optional (authenticated RLS tests):
 *   VERIFY_TUTOR_EMAIL=... VERIFY_TUTOR_PASSWORD=...
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
      process.env[k] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!url || !serviceKey || !anonKey) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function findTutorCohortPair(): Promise<{
  tutorId: string;
  assignedCohortId: string;
  unassignedCohortId: string;
  tutorEmail: string | null;
}> {
  const { data: cohorts, error } = await admin
    .from("cohorts")
    .select("id, tutor_id, name")
    .not("tutor_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  if (!cohorts?.length) throw new Error("No cohorts with tutor_id found.");

  const byTutor = new Map<string, string>();
  for (const row of cohorts) {
    if (row.tutor_id && !byTutor.has(row.tutor_id)) {
      byTutor.set(row.tutor_id, row.id);
    }
  }

  let tutorId: string | null = null;
  let assignedCohortId: string | null = null;
  let unassignedCohortId: string | null = null;

  for (const [tid, cid] of byTutor) {
    const other = cohorts.find((c) => c.tutor_id && c.tutor_id !== tid);
    if (other) {
      tutorId = tid;
      assignedCohortId = cid;
      unassignedCohortId = other.id;
      break;
    }
  }

  if (!tutorId || !assignedCohortId || !unassignedCohortId) {
    throw new Error("Need at least two cohorts with different tutors for negative tests.");
  }

  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const tutorEmail =
    userList?.users.find((u) => u.id === tutorId)?.email?.trim().toLowerCase() ?? null;

  return { tutorId, assignedCohortId, unassignedCohortId, tutorEmail };
}

async function assertTutorClient(
  client: SupabaseClient,
  assignedCohortId: string,
  unassignedCohortId: string
) {
  const { data: assignedRead, error: assignedReadErr } = await client
    .from("cohorts")
    .select("id")
    .eq("id", assignedCohortId)
    .maybeSingle();
  if (assignedReadErr) throw new Error(`assigned cohort read: ${assignedReadErr.message}`);
  if (!assignedRead) throw new Error("FAIL: tutor cannot read assigned cohort");

  const { data: unassignedRead } = await client
    .from("cohorts")
    .select("id")
    .eq("id", unassignedCohortId)
    .maybeSingle();
  if (unassignedRead) {
    throw new Error("FAIL: tutor can read unassigned cohort (cohorts policy too broad)");
  }

  const today = new Date().toISOString().slice(0, 10);
  const notionPageId = `verify-tutor-rls-${Date.now()}`;
  const userId = (await client.auth.getUser()).data.user?.id ?? null;

  const { data: inserted, error: insertErr } = await client
    .from("cohort_lesson_log_entries")
    .insert({
      notion_page_id: notionPageId,
      cohort_id: assignedCohortId,
      lesson_date: today,
      source: "app",
      logged_by: userId,
    })
    .select("id")
    .single();
  if (insertErr) throw new Error(`assigned lesson log insert: ${insertErr.message}`);
  if (!inserted?.id) throw new Error("FAIL: lesson log insert returned no row");

  const { error: updateErr } = await client
    .from("cohort_lesson_log_entries")
    .update({ notes: "verify-tutor-rls update" })
    .eq("id", inserted.id);
  if (updateErr) throw new Error(`assigned lesson log update: ${updateErr.message}`);

  const { error: badInsertErr } = await client.from("cohort_lesson_log_entries").insert({
    notion_page_id: `${notionPageId}-bad`,
    cohort_id: unassignedCohortId,
    lesson_date: today,
    source: "app",
  });
  if (!badInsertErr) {
    await admin.from("cohort_lesson_log_entries").delete().eq("notion_page_id", `${notionPageId}-bad`);
    throw new Error("FAIL: tutor inserted lesson log for unassigned cohort");
  }

  await admin.from("cohort_lesson_log_entries").delete().eq("id", inserted.id);
  console.log("PASS: tutor RLS — assigned cohort log + block unassigned cohort");
}

async function main() {
  console.log("Checking migration artifacts…");

  const { error: fnErr } = await admin.rpc("tutor_can_manage_lesson_log_entry" as never, {
    p_cohort_id: null,
    p_package_instance_id: null,
  } as never);

  if (fnErr && fnErr.message.includes("Could not find the function")) {
    console.error(
      "tutor_can_manage_lesson_log_entry missing — apply supabase/tutor-rls-scoping-fixes.sql first."
    );
    process.exit(1);
  }

  const { tutorId, assignedCohortId, unassignedCohortId, tutorEmail } =
    await findTutorCohortPair();
  console.log("Test tutor:", tutorId, tutorEmail ?? "(email unknown)");
  console.log("Assigned cohort:", assignedCohortId);
  console.log("Unassigned cohort:", unassignedCohortId);

  const email = process.env.VERIFY_TUTOR_EMAIL?.trim() || tutorEmail;
  const password = process.env.VERIFY_TUTOR_PASSWORD?.trim();

  if (!email || !password) {
    console.log(
      "SKIP authenticated RLS tests — set VERIFY_TUTOR_EMAIL + VERIFY_TUTOR_PASSWORD (tutor account, not master_admin)."
    );
    console.log("Structural checks only: migration function present, cohort pair found.");
    return;
  }

  const tutorClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signErr } = await tutorClient.auth.signInWithPassword({ email, password });
  if (signErr) throw new Error(`signIn: ${signErr.message}`);

  await assertTutorClient(tutorClient, assignedCohortId, unassignedCohortId);

  const { error: spErr } = await tutorClient.from("student_packages").select("id").limit(1);
  if (spErr) throw new Error(`student_packages read: ${spErr.message}`);
  console.log("PASS: tutor can query student_packages under RLS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
