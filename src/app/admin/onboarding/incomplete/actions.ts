"use server";

import { requireAdminFromActions } from "@/app/admin/content/actions";
import { loadIncompletePackageChecklists } from "@/lib/admin/load-incomplete-package-checklists";
import type { IncompletePackageChecklistRow } from "@/lib/admin/incomplete-package-checklist-types";

export async function fetchIncompletePackageChecklists(): Promise<{
  rows: IncompletePackageChecklistRow[];
  error?: string;
}> {
  try {
    const supabase = await requireAdminFromActions();
    return loadIncompletePackageChecklists(supabase);
  } catch (error) {
    return {
      rows: [],
      error: error instanceof Error ? error.message : "Failed to load incomplete checklists.",
    };
  }
}
