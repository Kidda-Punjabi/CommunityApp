import "server-only";

import { ASSIGNABLE_STAFF_ROLES } from "@/lib/auth/admin-access";
import type { UnseenAppOnboardingRow } from "@/lib/admin/unseen-app-onboarding-types";
import { loadEmailsByUserId } from "@/lib/admin/load-admin-profiles-with-email";
import { getStaffFacingName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { UnseenAppOnboardingRow };

const APP_ONBOARDING_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const EXCLUSION_ID_CHUNK = 500;

async function loadExcludedUserIds(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();

  const excluded = new Set<string>();
  for (let index = 0; index < userIds.length; index += EXCLUSION_ID_CHUNK) {
    const chunk = userIds.slice(index, index + EXCLUSION_ID_CHUNK);
    const { data, error } = await supabase.rpc("admin_unseen_onboarding_excluded_user_ids", {
      p_user_ids: chunk,
    });
    if (error) {
      throw new Error(error.message);
    }
    if (!Array.isArray(data)) {
      throw new Error("Onboarding exclusion query returned no result.");
    }
    for (const row of data as Array<{ id?: string }>) {
      if (row?.id) excluded.add(row.id);
    }
  }
  return excluded;
}

async function loadEmailsById(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, string | null>> {
  return loadEmailsByUserId(supabase, userIds);
}

export async function loadUnseenAppOnboarding(supabase: SupabaseClient): Promise<{
  rows: UnseenAppOnboardingRow[];
  error?: string;
}> {
  const nowMs = Date.now();
  const [{ data: profiles, error: profileError }, { data: staffRoles, error: roleError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, preferred_name, app_role, created_at")
        .eq("has_seen_onboarding", false),
      supabase
        .from("profile_roles")
        .select("user_id, role")
        .in("role", ASSIGNABLE_STAFF_ROLES),
    ]);

  if (profileError) return { rows: [], error: profileError.message };
  if (roleError) return { rows: [], error: roleError.message };

  const staffIds = new Set((staffRoles ?? []).map((row) => row.user_id as string));
  const staffRoleSet = new Set<string>(ASSIGNABLE_STAFF_ROLES);
  const studentProfiles = (profiles ?? []).filter((row) => {
    if (staffRoleSet.has(String(row.app_role ?? ""))) return false;
    if (staffIds.has(row.id as string)) return false;
    return true;
  });

  const excludedIds = await loadExcludedUserIds(
    supabase,
    studentProfiles.map((row) => row.id as string)
  );
  const visibleProfiles = studentProfiles.filter((row) => !excludedIds.has(row.id as string));

  const emailById = await loadEmailsById(
    supabase,
    visibleProfiles.map((row) => row.id as string)
  );

  const rows: UnseenAppOnboardingRow[] = visibleProfiles
    .map((row) => {
      const signedUpAt = (row.created_at as string) ?? new Date(0).toISOString();
      return {
        userId: row.id as string,
        displayName:
          getStaffFacingName({
            full_name: row.full_name as string | null,
            preferred_name: row.preferred_name as string | null,
          }) ?? emailById.get(row.id as string) ?? "Student",
        email: emailById.get(row.id as string) ?? null,
        signedUpAt,
        stale: nowMs - new Date(signedUpAt).getTime() >= APP_ONBOARDING_STALE_MS,
      };
    })
    .sort((a, b) => a.signedUpAt.localeCompare(b.signedUpAt));

  return { rows };
}
