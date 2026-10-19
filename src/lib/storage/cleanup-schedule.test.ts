import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cleanupDryRunEnabled,
  isLondonCleanupWindow,
  shouldNotifyCleanupFailure,
} from "./cleanup-schedule";

describe("cleanup schedule", () => {
  it("stays a dry run unless live mode is explicit", () => {
    assert.equal(cleanupDryRunEnabled({}), true);
    assert.equal(cleanupDryRunEnabled({ DATA_CLEANUP_DRY_RUN: "1" }), true);
    assert.equal(cleanupDryRunEnabled({ DATA_CLEANUP_DRY_RUN: "false" }), false);
    assert.equal(cleanupDryRunEnabled({ DATA_CLEANUP_DRY_RUN: "0" }), false);
  });

  it("matches 03:30 UK in summer and winter", () => {
    assert.equal(isLondonCleanupWindow(new Date("2026-10-19T02:30:00Z")), true);
    assert.equal(isLondonCleanupWindow(new Date("2026-01-15T03:30:00Z")), true);
    assert.equal(isLondonCleanupWindow(new Date("2026-10-19T03:30:00Z")), false);
    assert.equal(isLondonCleanupWindow(new Date("2026-01-15T02:30:00Z")), false);
  });

  it("emails only after two failed sweeps in a row", () => {
    assert.equal(shouldNotifyCleanupFailure("failed", true), true);
    assert.equal(shouldNotifyCleanupFailure("ok", true), false);
    assert.equal(shouldNotifyCleanupFailure("failed", false), false);
    assert.equal(shouldNotifyCleanupFailure(null, true), false);
  });
});
