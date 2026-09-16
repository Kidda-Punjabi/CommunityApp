import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export const NOTION_SYNC_LOCK_NAME = "notion-sync";
/** maxDuration is 300s; expire a little later so a killed run cannot block forever. */
export const NOTION_SYNC_LOCK_TTL_SECONDS = 360;

export async function tryAcquireNotionSyncLock(
  supabase: SupabaseClient,
  holder: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("try_acquire_notion_sync_lock", {
    p_name: NOTION_SYNC_LOCK_NAME,
    p_holder: holder,
    p_ttl_seconds: NOTION_SYNC_LOCK_TTL_SECONDS,
  });
  if (error) {
    console.error("[notion-sync] lock acquire failed:", error.message);
    return false;
  }
  return data === true;
}

export async function releaseNotionSyncLock(
  supabase: SupabaseClient,
  holder: string
): Promise<void> {
  const { error } = await supabase.rpc("release_notion_sync_lock", {
    p_name: NOTION_SYNC_LOCK_NAME,
    p_holder: holder,
  });
  if (error) {
    console.error("[notion-sync] lock release failed:", error.message);
  }
}
