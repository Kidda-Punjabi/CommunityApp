import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fcmUnregistered } from "./fcm-error";

describe("fcmUnregistered", () => {
  it("treats an UNREGISTERED token like a bad APNs token", () => {
    assert.equal(fcmUnregistered(404, ""), true);
    assert.equal(
      fcmUnregistered(400, JSON.stringify({ error: { details: [{ errorCode: "UNREGISTERED" }] } })),
      true
    );
    assert.equal(fcmUnregistered(500, JSON.stringify({ error: { status: "INTERNAL" } })), false);
  });
});
