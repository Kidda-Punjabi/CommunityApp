import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OLD_TIER_TO_KIDDA,
  bandChanged,
  cooldownUntil,
  failedRetakeAt,
  levelEstablishedAt,
  retakeMovesUp,
  xpRoad,
  xpTargetForLevel,
} from "./level-progress";

describe("xp road", () => {
  it("uses the settings target for the current level", () => {
    assert.equal(xpTargetForLevel(2, { "2": 150 }), 150);
    assert.equal(xpTargetForLevel(9, { "8": 350 }), null);
  });

  it("45 of 150 is 30 percent and 150 unlocks the retake", () => {
    assert.deepEqual(xpRoad(45, 150), { earned: 45, percent: 30, target: 150, unlocked: false });
    assert.equal(xpRoad(150, 150).unlocked, true);
    assert.equal(xpRoad(180, 150).percent, 100);
  });

  it("never moves down and only re-pods across a band", () => {
    assert.equal(retakeMovesUp(2, 2), false);
    assert.equal(retakeMovesUp(2, 4), true);
    assert.equal(bandChanged(2, 3), false);
    assert.equal(bandChanged(3, 4), true);
  });

  it("keeps the level-start clock through a failed retake", () => {
    const history = [
      { fromLevel: null, toLevel: 2, source: "placement" as const, createdAt: "2026-10-01T00:00:00Z" },
      { fromLevel: 2, toLevel: 2, source: "retake" as const, createdAt: "2026-10-20T00:00:00Z" },
    ];
    assert.equal(levelEstablishedAt(history, 2), "2026-10-01T00:00:00Z");
    assert.equal(failedRetakeAt(history), "2026-10-20T00:00:00Z");
    assert.equal(cooldownUntil("2026-10-17T00:00:00Z", 28, new Date("2026-10-20T00:00:00Z"))?.toISOString().slice(0, 10), "2026-11-14");
  });

  it("maps the old eight tiers onto Kidda levels", () => {
    assert.deepEqual(Object.values(OLD_TIER_TO_KIDDA), [0, 1, 1, 2, 3, 4, 6, 8]);
  });
});
