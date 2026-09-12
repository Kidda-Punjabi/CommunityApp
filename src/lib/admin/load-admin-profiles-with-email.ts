import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminProfileWithEmail = {
  id: string;
  email: string | null;
  auth_created_at: string | null;
  email_confirmed_at: string | null;
  full_name: string | null;
  avatar_url: string | null;
  membership_tier: string | null;
  created_at: string | null;
  updated_at: string | null;
  preferred_name: string | null;
  app_role: string | null;
  learner_level: number | null;
  placement_completed_at: string | null;
};

const ID_CHUNK = 500;

function uniqueIds(userIds: readonly string[]): string[] {
  return [...new Set(userIds.filter(Boolean))];
}

export async function loadAdminProfilesWithEmail(
  supabase: SupabaseClient,
  userIds?: readonly string[] | null
): Promise<AdminProfileWithEmail[]> {
  if (userIds && userIds.length === 0) return [];

  const ids = userIds ? uniqueIds(userIds) : null;
  if (ids && ids.length === 0) return [];

  const chunks: Array<string[] | null> =
    ids == null ? [null] : ids.length <= ID_CHUNK ? [ids] : chunk(ids, ID_CHUNK);

  const rows: AdminProfileWithEmail[] = [];
  for (const chunkIds of chunks) {
    const { data, error } = await supabase.rpc("admin_profiles_with_email", {
      p_user_ids: chunkIds,
    });
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as AdminProfileWithEmail[]));
  }
  return rows;
}

export async function loadEmailsByUserId(
  supabase: SupabaseClient,
  userIds?: readonly string[] | null
): Promise<Map<string, string | null>> {
  const rows = await loadAdminProfilesWithEmail(supabase, userIds);
  const emailById = new Map<string, string | null>();
  for (const row of rows) {
    emailById.set(row.id, row.email ?? null);
  }
  return emailById;
}

export async function loadAuthEmailSet(supabase: SupabaseClient): Promise<Set<string>> {
  const rows = await loadAdminProfilesWithEmail(supabase, null);
  const emails = new Set<string>();
  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();
    if (email) emails.add(email);
  }
  return emails;
}

export async function loadEmailToUserIdMap(
  supabase: SupabaseClient
): Promise<Map<string, string>> {
  const rows = await loadAdminProfilesWithEmail(supabase, null);
  const map = new Map<string, string>();
  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();
    if (email) map.set(email, row.id);
  }
  return map;
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}
