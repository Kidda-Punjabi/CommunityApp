import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Test sessions are community_sessions rows with is_active = false (today: "Kidda team test").
 * Their occurrences are staff-only: members never see them as live, can't check in to them,
 * and check-ins to them earn no XP and count for no streak.
 */
export const TEST_SESSION_TITLE = "Kidda team test";

/** Master admins and hosts of an active Community session. */
export async function isCommunityStaffUser(admin: SupabaseClient, userId: string): Promise<boolean> {
  const [profile, roles, host] = await Promise.all([
    admin.from("profiles").select("app_role").eq("id", userId).maybeSingle(),
    admin.from("profile_roles").select("role").eq("user_id", userId),
    admin
      .from("community_sessions")
      .select("id")
      .eq("host_tutor_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
  ]);
  if (profile.data?.app_role === "master_admin") return true;
  if ((roles.data ?? []).some((row) => row.role === "master_admin")) return true;
  return Boolean(host.data);
}

type LiveRow = { id: string; checkin_code: string | null; community_sessions: { is_active: boolean } | { is_active: boolean }[] | null };

function sessionIsActive(row: LiveRow): boolean {
  const session = Array.isArray(row.community_sessions) ? row.community_sessions[0] : row.community_sessions;
  return session?.is_active !== false;
}

/** Live occurrences this user may see: real sessions for everyone, test sessions for staff only. */
export async function visibleLiveOccurrences(
  admin: SupabaseClient,
  userId: string
): Promise<{ id: string; checkinCode: string | null }[]> {
  const { data, error } = await admin
    .from("community_session_occurrences")
    .select("id, checkin_code, community_sessions(is_active)")
    .eq("status", "live");
  if (error) throw error;
  const rows = (data ?? []) as LiveRow[];
  const hasTest = rows.some((row) => !sessionIsActive(row));
  const staff = hasTest ? await isCommunityStaffUser(admin, userId) : false;
  return rows
    .filter((row) => staff || sessionIsActive(row))
    .map((row) => ({ id: row.id, checkinCode: row.checkin_code }));
}

/** True when the occurrence belongs to a test (inactive) session. */
export async function occurrenceIsTest(admin: SupabaseClient, sessionId: string): Promise<boolean> {
  const { data, error } = await admin.from("community_sessions").select("is_active").eq("id", sessionId).maybeSingle();
  if (error) throw error;
  return data?.is_active === false;
}
