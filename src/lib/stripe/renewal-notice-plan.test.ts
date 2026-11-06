import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  renewalMessage,
  renewalSubscriptionName,
  shouldSendRenewalNotice,
  type RenewalCandidate,
} from "./renewal-notice-plan";

const NOW = new Date("2026-12-12T09:00:00Z");
const DAY = 24 * 60 * 60;
const nowSeconds = NOW.getTime() / 1000;

const renewing: RenewalCandidate = {
  status: "active",
  cancelAtPeriodEnd: false,
  cancelAt: null,
  paused: false,
  periodEnd: nowSeconds + 7 * DAY,
};

describe("renewal notice rules", () => {
  it("notifies a subscription renewing within 7 days", () => {
    assert.equal(shouldSendRenewalNotice(renewing, NOW), true);
  });

  it("waits when the renewal is more than 7 days away", () => {
    assert.equal(shouldSendRenewalNotice({ ...renewing, periodEnd: nowSeconds + 7 * DAY + 60 }, NOW), false);
  });

  it("ignores a period that has already ended", () => {
    assert.equal(shouldSendRenewalNotice({ ...renewing, periodEnd: nowSeconds - 60 }, NOW), false);
  });

  it("skips anything that will not renew", () => {
    assert.equal(shouldSendRenewalNotice({ ...renewing, cancelAtPeriodEnd: true }, NOW), false);
    assert.equal(shouldSendRenewalNotice({ ...renewing, cancelAt: nowSeconds + 90 * DAY }, NOW), false);
    assert.equal(shouldSendRenewalNotice({ ...renewing, paused: true }, NOW), false);
    assert.equal(shouldSendRenewalNotice({ ...renewing, status: "past_due" }, NOW), false);
  });

  it("names the subscription and the date", () => {
    assert.equal(renewalSubscriptionName("Premium App", true), "Kidda Premium");
    assert.equal(renewalSubscriptionName("Kidda Community", false), "Kidda Community");
    assert.equal(
      renewalMessage("Kidda Community", new Date("2027-01-21T10:00:00Z")),
      "Your Kidda Community subscription renews on 21 January."
    );
  });
});
