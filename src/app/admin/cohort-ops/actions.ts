"use server";

import { requireAdminFromActions } from "@/app/admin/content/actions";
import {
  integrityIssues,
  setupIssues,
  type CohortOpsIssue,
} from "@/lib/admin/dashboard/cohort-ops-issues";
import { loadCohortOpsIssues } from "@/lib/admin/dashboard/load-cohort-ops-issues";

export async function fetchCohortOpsIssueList(kind: "setup" | "integrity"): Promise<{
  issues: CohortOpsIssue[];
  error?: string;
}> {
  try {
    const supabase = await requireAdminFromActions();
    const result = await loadCohortOpsIssues(supabase);
    return {
      issues: kind === "setup" ? setupIssues(result.issues) : integrityIssues(result.issues),
      error: result.error,
    };
  } catch (error) {
    return {
      issues: [],
      error: error instanceof Error ? error.message : "Could not load cohort issues.",
    };
  }
}
