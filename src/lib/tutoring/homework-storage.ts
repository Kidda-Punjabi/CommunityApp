import "server-only";

import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Homework recordings for kid profiles live at `{lessonId}/{kidProfileId}/…`.
 * Storage RLS still keys the second path segment to `auth.uid()`, so uploads
 * and signed URLs must use the service role after the caller has already
 * authorised the homework row.
 */
export function homeworkStorageClient(userClient: SupabaseClient): SupabaseClient {
  return tryCreateServiceRoleClient().client ?? userClient;
}
