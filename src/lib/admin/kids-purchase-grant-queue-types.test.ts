import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isKidsPurchaseQueueViewId,
  KIDS_PURCHASE_QUEUE_VIEW_ID,
  selectUnresolvedKidsPurchaseQueueRows,
} from "./kids-purchase-grant-queue-types";

describe("selectUnresolvedKidsPurchaseQueueRows", () => {
  it("drops resolved rows and sorts unresolved oldest-first", () => {
    const rows = [
      { id: "new", resolved: false, createdAt: "2026-09-10T10:00:00.000Z" },
      { id: "resolved", resolved: true, createdAt: "2026-08-01T10:00:00.000Z" },
      { id: "old", resolved: false, createdAt: "2026-08-20T10:00:00.000Z" },
    ];

    assert.deepEqual(
      selectUnresolvedKidsPurchaseQueueRows(rows).map((row) => row.id),
      ["old", "new"]
    );
  });
});

describe("isKidsPurchaseQueueViewId", () => {
  it("matches the built-in packages tab id", () => {
    assert.equal(isKidsPurchaseQueueViewId(KIDS_PURCHASE_QUEUE_VIEW_ID), true);
    assert.equal(isKidsPurchaseQueueViewId(null), false);
    assert.equal(isKidsPurchaseQueueViewId("1ef42046-cb42-4457-abbc-945ff1162e68"), false);
  });
});
