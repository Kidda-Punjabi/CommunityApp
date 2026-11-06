import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { knownSlotsBySkill, pickMix, seenAnywhere } from "./round-mix";

describe("round mix", () => {
  it("gives a 12 question round 3 review slots, away from Words", () => {
    const slots = knownSlotsBySkill(["words", "grammar", "listening", "speaking"], 12);
    assert.deepEqual([...slots.values()], [0, 1, 1, 1]);
  });
  it("treats anything met in another skill as seen", () => {
    assert.equal(seenAnywhere(new Map([["listening:a", 0]]), "a"), true);
    assert.equal(seenAnywhere(new Map(), "a"), false);
  });
  it("fills with new when nothing is known yet", () => {
    const mix = pickMix([1, 2, 3], [], 3, 1);
    assert.deepEqual(mix.fresh, [1, 2, 3]);
    assert.equal(mix.shortOfNew, 0);
  });
  it("reports how many new ones are missing", () => {
    const mix = pickMix([1], [7, 8, 9], 3, 1);
    assert.deepEqual(mix.fresh, [1]);
    assert.deepEqual(mix.review, [7]);
    assert.equal(mix.shortOfNew, 1);
  });
});
