/** Built-in Packages board tab, stored in the same session key as saved views. */
export const KIDS_PURCHASE_QUEUE_VIEW_ID = "kids-purchase-queue";
export const KIDS_PURCHASE_QUEUE_VIEW_QUERY = "kids-purchases";

export type KidsPurchaseGrantQueueRow = {
  id: string;
  stripeCheckoutSessionId: string;
  parentEmail: string | null;
  kidName: string | null;
  reason: string;
  rawMetadata: Record<string, unknown>;
  resolved: boolean;
  createdAt: string;
  cohortId: string | null;
  cohortName: string | null;
};

export function isKidsPurchaseQueueViewId(viewId: string | null | undefined): boolean {
  return viewId === KIDS_PURCHASE_QUEUE_VIEW_ID;
}

/** Unresolved rows, oldest first (longest sitting = most urgent). */
export function selectUnresolvedKidsPurchaseQueueRows<
  T extends { resolved: boolean; createdAt: string },
>(rows: T[]): T[] {
  return rows
    .filter((row) => !row.resolved)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
