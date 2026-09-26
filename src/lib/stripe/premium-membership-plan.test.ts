import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  awaitingCheckoutMessage,
  duplicateSubscriptionMessage,
  planPremiumMembershipWrite,
  unmatchedCheckoutMessage,
  type PremiumMembershipSnapshot,
} from "./premium-membership-plan";

function row(
  overrides: Partial<PremiumMembershipSnapshot> & Pick<PremiumMembershipSnapshot, "id">
): PremiumMembershipSnapshot {
  return {
    userId: "user-1",
    stripeSubscriptionId: "sub_old",
    status: "active",
    ...overrides,
  };
}

describe("planPremiumMembershipWrite", () => {
  it("updates the row for the same subscription", () => {
    const plan = planPremiumMembershipWrite({
      userId: "user-1",
      subscriptionId: "sub_same",
      subscriptionRow: row({ id: "m1", stripeSubscriptionId: "sub_same" }),
      userPremiumRows: [],
    });
    assert.deepEqual(plan, { action: "update", membershipId: "m1" });
  });

  it("does not overwrite a different active or trialing subscription", () => {
    const active = planPremiumMembershipWrite({
      userId: "user-1",
      subscriptionId: "sub_new",
      subscriptionRow: null,
      userPremiumRows: [row({ id: "m1", status: "active", stripeSubscriptionId: "sub_old" })],
    });
    assert.equal(active.action, "duplicate");

    const trialing = planPremiumMembershipWrite({
      userId: "user-1",
      subscriptionId: "sub_new",
      subscriptionRow: null,
      userPremiumRows: [row({ id: "m1", status: "trialing", stripeSubscriptionId: "sub_old" })],
    });
    assert.equal(trialing.action, "duplicate");
  });

  it("replaces a cancelled premium row", () => {
    const plan = planPremiumMembershipWrite({
      userId: "user-1",
      subscriptionId: "sub_new",
      subscriptionRow: null,
      userPremiumRows: [row({ id: "m1", status: "canceled", stripeSubscriptionId: "sub_old" })],
    });
    assert.deepEqual(plan, { action: "update", membershipId: "m1" });
  });

  it("inserts when the user has no premium row", () => {
    const plan = planPremiumMembershipWrite({
      userId: "user-1",
      subscriptionId: "sub_new",
      subscriptionRow: null,
      userPremiumRows: [],
    });
    assert.deepEqual(plan, { action: "insert" });
  });
});

describe("premium webhook messages", () => {
  it("names both subscription ids and the checkout email", () => {
    assert.equal(
      duplicateSubscriptionMessage("sub_old", "sub_new"),
      "already has sub_old, not applying sub_new"
    );
    assert.equal(
      awaitingCheckoutMessage("sub_new"),
      "awaiting checkout resolution, sub sub_new"
    );
    assert.equal(
      unmatchedCheckoutMessage("Person@Example.com", "sub_new"),
      "no app user for Person@Example.com, sub sub_new"
    );
  });
});
