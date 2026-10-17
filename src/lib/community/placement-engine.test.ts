import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPlacementAnswer,
  initialPlacementState,
  replayPlacement,
  scorePlacement,
  startLevelFromProfile,
} from "./placement-engine";

describe("placement engine", () => {
  it("maps the two profile answers onto the start ladder", () => {
    assert.equal(startLevelFromProfile(0, 0), 1);
    assert.equal(startLevelFromProfile(0, 1), 1);
    assert.equal(startLevelFromProfile(1, 1), 2);
    assert.equal(startLevelFromProfile(3, 3), 6);
  });

  it("passes every level when every answer is right", () => {
    const answers = Array.from({ length: 9 * 2 }, () => true);
    const state = replayPlacement(1, answers);
    const scores = scorePlacement(state);
    assert.equal(state.phase, "done");
    assert.equal(scores.understanding, 9);
    assert.equal(scores.speaking, 9);
    assert.equal(scores.kiddaLevel, 9);
  });

  it("drops two levels when understanding fails at the start", () => {
    let state = initialPlacementState(4);
    state = applyPlacementAnswer(state, false);
    state = applyPlacementAnswer(state, false);
    assert.equal(state.dropped, true);
    assert.equal(state.L, 2);
    assert.equal(state.ceiling, 4);
    assert.equal(state.assumed, 1);
  });

  it("stops speaking items after the first speaking miss", () => {
    let state = initialPlacementState(1);
    state = applyPlacementAnswer(state, true);
    state = applyPlacementAnswer(state, false);
    assert.equal(state.stopS, true);
    assert.equal(state.L, 2);
    state = applyPlacementAnswer(state, true);
    assert.equal(state.step, "U1");
    assert.equal(state.L, 3);
    const scores = scorePlacement({ ...state, phase: "done" });
    assert.equal(scores.speaking, 0);
    assert.equal(scores.understanding, 2);
  });

  it("asks the sound items when level 1 understanding fails", () => {
    let state = initialPlacementState(1);
    state = applyPlacementAnswer(state, false);
    state = applyPlacementAnswer(state, false);
    assert.equal(state.phase, "sound");
    state = applyPlacementAnswer(state, false);
    state = applyPlacementAnswer(state, true);
    assert.equal(state.phase, "done");
    const scores = scorePlacement(state);
    assert.equal(scores.understanding, 0);
    assert.equal(scores.kiddaLevel, 0);
    assert.equal(scores.soundIssue, true);
  });
});
