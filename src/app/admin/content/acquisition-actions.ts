"use server";

import { requireAdminFromActions } from "@/app/admin/content/actions";
import { loadAcquisitionSnapshot } from "@/lib/admin/acquisition/load-acquisition";
import type {
  AcquisitionRangeId,
  AcquisitionSnapshot,
} from "@/lib/admin/acquisition/types";

export type { AcquisitionRangeId, AcquisitionSnapshot };

export async function fetchAcquisitionDashboard(input?: {
  rangeId?: AcquisitionRangeId;
  from?: string;
  to?: string;
}): Promise<{ snapshot?: AcquisitionSnapshot; error?: string }> {
  try {
    const supabase = await requireAdminFromActions();
    const snapshot = await loadAcquisitionSnapshot(supabase, {
      rangeId: input?.rangeId,
      from: input?.from,
      to: input?.to,
    });
    return { snapshot };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to load acquisition.",
    };
  }
}
