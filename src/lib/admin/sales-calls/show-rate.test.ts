import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isShowRateEligible, isShowedCall } from "./show-rate";

describe("show rate eligibility", () => {
  it("excludes cancelled and rescheduled even when Show Up is true", () => {
    assert.equal(isShowRateEligible("Cancelled", true), false);
    assert.equal(isShowedCall("Cancelled", true), false);
    assert.equal(isShowRateEligible("Rescheduled", false), false);
    assert.equal(isShowedCall("Rescheduled", true), false);
  });

  it("excludes empty outcome with Show Up false", () => {
    assert.equal(isShowRateEligible(null, false), false);
    assert.equal(isShowRateEligible("", false), false);
    assert.equal(isShowedCall(null, false), false);
  });

  it("keeps No Show in the denominator only", () => {
    assert.equal(isShowRateEligible("No Show", false), true);
    assert.equal(isShowedCall("No Show", false), false);
    assert.equal(isShowedCall("No Show", true), false);
  });

  it("counts listed outcomes as showed even when Show Up is false", () => {
    assert.equal(isShowedCall("Closed", false), true);
    assert.equal(isShowedCall("Follow Up", false), true);
    assert.equal(isShowedCall("Rebook", false), true);
    assert.equal(isShowedCall("Enrolment Call Booked", false), true);
    assert.equal(isShowedCall("Check-In Call Booked", false), true);
    assert.equal(isShowedCall("Can't Afford", false), true);
    assert.equal(isShowedCall("Not Interested", false), true);
    assert.equal(isShowedCall("Refunded", false), true);
    assert.equal(isShowedCall("Interested in Kids Classes", false), true);
  });

  it("counts Show Up true with empty outcome as showed", () => {
    assert.equal(isShowRateEligible(null, true), true);
    assert.equal(isShowedCall(null, true), true);
  });
});
