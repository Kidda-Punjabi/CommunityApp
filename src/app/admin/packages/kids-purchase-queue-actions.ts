"use server";

import { requireAdminFromActions } from "@/app/admin/content/actions";
import { loadKidsPurchaseGrantQueue } from "@/lib/admin/kids-purchase-grant-queue";
import type { KidsPurchaseGrantQueueRow } from "@/lib/admin/kids-purchase-grant-queue-types";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";

export async function fetchKidsPurchaseGrantQueue(): Promise<{
  rows: KidsPurchaseGrantQueueRow[];
  error?: string;
}> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    return loadKidsPurchaseGrantQueue(supabase);
  } catch (e) {
    return {
      rows: [],
      error: e instanceof Error ? e.message : "Failed to load kids purchase queue.",
    };
  }
}
