import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideLeadPurchaseGrant,
  isHistoricalPackageTarget,
  isLeadGrantQueueUniqueViolation,
  sortedPackagePageIdsKey,
} from "./lead-purchase-access-grant-logic";

describe("isHistoricalPackageTarget", () => {
  it("excludes completed cohorts and package instances", () => {
    assert.equal(
      isHistoricalPackageTarget({ kind: "cohort", status: "classes_completed" }),
      true
    );
    assert.equal(
      isHistoricalPackageTarget({ kind: "package_instance", status: "offboarding_complete" }),
      true
    );
  });

  it("excludes package instances that are not expected to get app access", () => {
    assert.equal(
      isHistoricalPackageTarget({
        kind: "package_instance",
        status: "in_progress",
        appAccessExpected: false,
      }),
      true
    );
  });

  it("keeps a live cohort and a live package instance", () => {
    assert.equal(isHistoricalPackageTarget({ kind: "cohort", status: "in_progress" }), false);
    assert.equal(
      isHistoricalPackageTarget({
        kind: "package_instance",
        status: "recruiting",
        appAccessExpected: true,
      }),
      false
    );
  });
});

describe("decideLeadPurchaseGrant", () => {
  it("grants the one live package left after historical packages are removed", () => {
    assert.deepEqual(decideLeadPurchaseGrant({ liveCount: 1, unresolvedCount: 0 }), {
      type: "grant",
    });
  });

  it("grants when one live package remains even if another page is unresolved", () => {
    assert.deepEqual(decideLeadPurchaseGrant({ liveCount: 1, unresolvedCount: 1 }), {
      type: "grant",
    });
  });

  it("queues only when two or more live packages remain", () => {
    assert.deepEqual(decideLeadPurchaseGrant({ liveCount: 2, unresolvedCount: 0 }), {
      type: "queue",
      reason: "ambiguous_multiple_packages",
    });
  });

  it("does not grant or queue when every package is historical", () => {
    const decision = decideLeadPurchaseGrant({ liveCount: 0, unresolvedCount: 0 });
    assert.equal(decision.type, "skip");
  });

  it("still queues a package that is not in the app yet", () => {
    assert.deepEqual(decideLeadPurchaseGrant({ liveCount: 0, unresolvedCount: 1 }), {
      type: "queue",
      reason: "unresolvable_package",
    });
  });
});

describe("sortedPackagePageIdsKey", () => {
  it("sorts package page ids so insert order does not matter", () => {
    assert.equal(
      sortedPackagePageIdsKey({ packagePageIds: ["b-page", "a-page"] }),
      sortedPackagePageIdsKey({ packagePageIds: ["a-page", "b-page"] })
    );
  });

  it("is empty when the payload has no package page ids", () => {
    assert.equal(sortedPackagePageIdsKey({ error: "fetch failed" }), "");
    assert.equal(sortedPackagePageIdsKey(null), "");
  });
});

describe("isLeadGrantQueueUniqueViolation", () => {
  it("treats the postgres unique violation as already queued", () => {
    assert.equal(isLeadGrantQueueUniqueViolation({ code: "23505", message: "duplicate key" }), true);
  });

  it("does not hide unrelated insert errors", () => {
    assert.equal(
      isLeadGrantQueueUniqueViolation({ code: "42501", message: "permission denied" }),
      false
    );
  });
});
