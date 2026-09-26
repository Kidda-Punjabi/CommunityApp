import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  billingMembershipsForCard,
  billingSubscriptionName,
  customerIdsFromMemberships,
  type BillingMembershipRow,
} from "./billing-memberships";

function row(overrides: Partial<BillingMembershipRow> = {}): BillingMembershipRow {
  return {
    id: "m1",
    status: "active",
    tier_name: "premium",
    stripe_customer_id: "cus_123",
    stripe_subscription_id: "sub_123",
    ...overrides,
  };
}

describe("billingSubscriptionName", () => {
  it("labels premium as Kidda Premium", () => {
    assert.equal(billingSubscriptionName("premium"), "Kidda Premium");
  });

  it("keeps a course tier label", () => {
    assert.equal(billingSubscriptionName("community"), "Kidda Community");
  });
});

describe("billingMembershipsForCard", () => {
  it("keeps active, trialing, and past_due rows", () => {
    const shown = billingMembershipsForCard([
      row({ id: "a", status: "active" }),
      row({ id: "t", status: "trialing" }),
      row({ id: "p", status: "past_due" }),
      row({ id: "c", status: "canceled" }),
      row({ id: "u", status: "unpaid" }),
    ]);
    assert.deepEqual(
      shown.map((item) => item.id),
      ["a", "t", "p"]
    );
  });
});

describe("customerIdsFromMemberships", () => {
  it("collects distinct stored customer ids, including inactive rows", () => {
    assert.deepEqual(
      customerIdsFromMemberships([
        row({ stripe_customer_id: "cus_a" }),
        row({ status: "canceled", stripe_customer_id: "cus_a" }),
        row({ stripe_customer_id: " cus_b " }),
        row({ stripe_customer_id: null }),
      ]),
      ["cus_a", "cus_b"]
    );
  });
});
