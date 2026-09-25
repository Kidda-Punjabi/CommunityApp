export const COMPLETED_RUN_STATUSES = ["classes_completed", "offboarding_complete"] as const;

export type LeadGrantQueueReason =
  | "ambiguous_multiple_packages"
  | "unresolvable_package"
  | "ambiguous_package_match";

export type LeadGrantDecision =
  | { type: "grant" }
  | { type: "queue"; reason: LeadGrantQueueReason }
  | { type: "skip"; detail: string };

export function isCompletedRunStatus(status: string | null | undefined): boolean {
  return status === "classes_completed" || status === "offboarding_complete";
}

/** Completed runs, and 1-1 instances that are not expected to get app access. */
export function isHistoricalPackageTarget(input: {
  kind: "cohort" | "package_instance";
  status: string | null | undefined;
  appAccessExpected?: boolean | null;
}): boolean {
  if (isCompletedRunStatus(input.status)) return true;
  if (input.kind === "package_instance" && input.appAccessExpected === false) return true;
  return false;
}

/**
 * Decide from live (grantable) matches vs pages that did not match a row.
 * Historical packages are already excluded from both counts.
 */
export function decideLeadPurchaseGrant(input: {
  liveCount: number;
  unresolvedCount: number;
}): LeadGrantDecision {
  if (input.liveCount === 1) {
    return { type: "grant" };
  }
  if (input.liveCount >= 2) {
    return { type: "queue", reason: "ambiguous_multiple_packages" };
  }
  if (input.unresolvedCount > 0) {
    return { type: "queue", reason: "unresolvable_package" };
  }
  return {
    type: "skip",
    detail: "No live packages remain after excluding completed or non-app packages.",
  };
}

/** Sorted package page ids, matching lead_grant_queue_package_ids_hash in Postgres. */
export function sortedPackagePageIdsKey(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const ids = (raw as { packagePageIds?: unknown }).packagePageIds;
  if (!Array.isArray(ids)) return "";
  const strings: string[] = [];
  for (const id of ids) {
    if (typeof id === "string") strings.push(id);
  }
  strings.sort();
  return strings.join(",");
}

export function isLeadGrantQueueUniqueViolation(error: {
  code?: string;
  message?: string;
}): boolean {
  if (error.code === "23505") return true;
  const message = error.message ?? "";
  return message.includes("duplicate key") && message.includes("notion_lead_purchase_grant_queue");
}
