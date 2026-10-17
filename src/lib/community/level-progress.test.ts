import assert from "node:assert/strict";
import test from "node:test";
import {
  bandChanged,
  cooldownUntil,
  failedRetakeAt,
  levelEstablishedAt,
  retakeMovesUp,
  roadProgress,
} from "./level-progress";

test("three of ten main sessions is 30 percent", () => {
  assert.deepEqual(roadProgress(3, 10), { done: 3, percent: 30, unlocked: false });
});

test("ten main sessions unlock the retake and extra sessions stay capped", () => {
  assert.deepEqual(roadProgress(10, 10), { done: 10, percent: 100, unlocked: true });
  assert.equal(roadProgress(14, 10).percent, 100);
});

test("a lower or equal retake never counts as moving up", () => {
  assert.equal(retakeMovesUp(2, 4), true);
  assert.equal(retakeMovesUp(2, 2), false);
  assert.equal(retakeMovesUp(2, 0), false);
});

test("only a band change asks for a new pod", () => {
  assert.equal(bandChanged(2, 3), false);
  assert.equal(bandChanged(3, 4), true);
  assert.equal(bandChanged(6, 7), true);
});

test("progress starts when the current level was set, not on a failed retake", () => {
  const history = [
    { fromLevel: null, toLevel: 2, source: "placement" as const, createdAt: "2026-10-01T00:00:00Z" },
    { fromLevel: 2, toLevel: 2, source: "retake" as const, createdAt: "2026-10-20T00:00:00Z" },
  ];
  assert.equal(levelEstablishedAt(history, 2), "2026-10-01T00:00:00Z");
  assert.equal(failedRetakeAt(history), "2026-10-20T00:00:00Z");
});

test("cooldown uses the settings length and a later rise clears it", () => {
  const until = cooldownUntil("2026-10-01T00:00:00Z", 28, new Date("2026-10-20T00:00:00Z"));
  assert.equal(until?.toISOString().slice(0, 10), "2026-10-29");
  assert.equal(cooldownUntil("2026-10-01T00:00:00Z", 28, new Date("2026-11-01T00:00:00Z")), null);
  const risen = [
    { fromLevel: 2, toLevel: 2, source: "retake" as const, createdAt: "2026-10-01T00:00:00Z" },
    { fromLevel: 2, toLevel: 4, source: "retake" as const, createdAt: "2026-11-01T00:00:00Z" },
  ];
  assert.equal(failedRetakeAt(risen), null);
});
