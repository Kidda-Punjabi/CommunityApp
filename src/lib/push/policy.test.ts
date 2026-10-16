import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatLocalTime,
  inSendWindow,
  isQuietHours,
  planDelivery,
  zonedLocalToUtc,
} from "./policy";

const LONDON = "Europe/London";

describe("push delivery policy", () => {
  it("treats 10pm London as quiet and defers a homework reminder to 8am", () => {
    const now = zonedLocalToUtc(2026, 10, 16, 22, 0, LONDON);
    assert.equal(isQuietHours(now, LONDON), true);
    const plan = planDelivery({
      type: "H1",
      now,
      timeZone: LONDON,
      categoryEnabled: true,
      logStatus: null,
      sentNonClassToday: 0,
      expiresAt: zonedLocalToUtc(2026, 10, 17, 9, 0, LONDON),
    });
    assert.equal(plan.action, "defer");
    if (plan.action !== "defer") return;
    assert.equal(plan.reason, "quiet hours");
    assert.equal(zonedLocalToUtc(2026, 10, 17, 8, 0, LONDON).toISOString(), plan.notBefore.toISOString());
  });

  it("lets a class-starting reminder send during quiet hours", () => {
    const now = zonedLocalToUtc(2026, 10, 16, 22, 5, LONDON);
    const plan = planDelivery({
      type: "C2",
      now,
      timeZone: LONDON,
      categoryEnabled: true,
      logStatus: null,
      sentNonClassToday: 9,
    });
    assert.equal(plan.action, "send");
  });

  it("drops a reminder that would only send after the class has happened", () => {
    const now = zonedLocalToUtc(2026, 10, 16, 22, 0, LONDON);
    const plan = planDelivery({
      type: "H3",
      now,
      timeZone: LONDON,
      categoryEnabled: true,
      logStatus: null,
      sentNonClassToday: 0,
      expiresAt: zonedLocalToUtc(2026, 10, 16, 23, 0, LONDON),
    });
    assert.equal(plan.action, "drop");
  });

  it("defers a fourth non-class push the same local day", () => {
    const now = zonedLocalToUtc(2026, 10, 16, 18, 0, LONDON);
    const plan = planDelivery({
      type: "S1",
      now,
      timeZone: LONDON,
      categoryEnabled: true,
      logStatus: null,
      sentNonClassToday: 3,
      expiresAt: zonedLocalToUtc(2026, 10, 17, 12, 0, LONDON),
    });
    assert.equal(plan.action, "defer");
    if (plan.action !== "defer") return;
    assert.equal(plan.reason, "daily cap");
  });

  it("does not count class reminders toward the cap", () => {
    const now = zonedLocalToUtc(2026, 10, 16, 18, 0, LONDON);
    const plan = planDelivery({
      type: "C1",
      now,
      timeZone: LONDON,
      categoryEnabled: true,
      logStatus: null,
      sentNonClassToday: 3,
    });
    assert.equal(plan.action, "send");
  });

  it("skips a category the person turned off", () => {
    const plan = planDelivery({
      type: "S1",
      now: new Date("2026-10-16T17:00:00.000Z"),
      timeZone: LONDON,
      categoryEnabled: false,
      logStatus: null,
      sentNonClassToday: 0,
    });
    assert.deepEqual(plan, { action: "skip", reason: "category off" });
  });

  it("does not send forum or community pushes about a kid profile", () => {
    const plan = planDelivery({
      type: "F1",
      now: new Date("2026-10-16T17:00:00.000Z"),
      timeZone: LONDON,
      categoryEnabled: true,
      logStatus: null,
      sentNonClassToday: 0,
      kidProfileId: "kid-1",
    });
    assert.equal(plan.action, "skip");
  });

  it("converts 6pm London in October to 17:00 UTC", () => {
    const instant = zonedLocalToUtc(2026, 10, 16, 18, 0, LONDON);
    assert.equal(instant.toISOString(), "2026-10-16T17:00:00.000Z");
    assert.equal(formatLocalTime(instant.toISOString(), LONDON), "6:00 pm");
    assert.equal(inSendWindow(new Date(instant.getTime() + 60_000), instant), true);
    assert.equal(inSendWindow(new Date(instant.getTime() + 7 * 60_000), instant), false);
  });
});
