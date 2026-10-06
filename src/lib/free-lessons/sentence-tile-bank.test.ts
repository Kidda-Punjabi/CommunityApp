import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  gurmukhiSequenceMatches,
  normaliseTileGurmukhi,
  selectSentenceTileDistractors,
  sentenceTileDistractorTarget,
} from "./sentence-tile-bank";

describe("normaliseTileGurmukhi", () => {
  it("trims and strips trailing punctuation", () => {
    assert.equal(normaliseTileGurmukhi("  ਦੋ? "), "ਦੋ");
    assert.equal(normaliseTileGurmukhi("ਨੇ."), "ਨੇ");
    assert.equal(normaliseTileGurmukhi("ਵਜੇ,"), "ਵਜੇ");
    assert.equal(normaliseTileGurmukhi("ਕਿੰਨੇ"), "ਕਿੰਨੇ");
  });
});

describe("selectSentenceTileDistractors", () => {
  const answer = ["ਕਿੰਨੇ", "ਵਜੇ", "ਨੇ?"];

  it("keeps one tile when the same word appears on more than one card", () => {
    const deck = [
      { gurmukhi: "ਦੋ", romanised: "Do" },
      { gurmukhi: "ਦੋ", romanised: "Do" },
      { gurmukhi: "ਤਿੰਨ", romanised: "Tinn" },
    ];
    const picked = selectSentenceTileDistractors(answer, deck, 2);
    assert.deepEqual(
      picked.map((part) => part.gurmukhi),
      ["ਦੋ", "ਤਿੰਨ"]
    );
  });

  it("treats punctuation variants as the same distractor", () => {
    const deck = [
      { gurmukhi: "ਦੋ", romanised: "Do" },
      { gurmukhi: "ਦੋ?", romanised: "Do" },
    ];
    const picked = selectSentenceTileDistractors(
      answer,
      deck,
      sentenceTileDistractorTarget(answer.length)
    );
    assert.equal(picked.length, 1);
    assert.equal(normaliseTileGurmukhi(picked[0].gurmukhi), "ਦੋ");
  });

  it("drops distractors that repeat an answer word", () => {
    const deck = [
      { gurmukhi: "ਨੇ", romanised: "Ne" },
      { gurmukhi: "ਵਜੇ.", romanised: "Vaje" },
      { gurmukhi: "ਦੋ", romanised: "Do" },
    ];
    const picked = selectSentenceTileDistractors(answer, deck, 2);
    assert.deepEqual(
      picked.map((part) => normaliseTileGurmukhi(part.gurmukhi)),
      ["ਦੋ"]
    );
  });

  it("returns fewer distractors when the deck runs out of unique words", () => {
    const longAnswer = ["ਹੁਣ", "ਕਿੰਨੇ", "ਵਜੇ", "ਨੇ"];
    const deck = [
      { gurmukhi: "ਪੰਜ", romanised: "Panj" },
      { gurmukhi: "ਪੰਜ.", romanised: "Panj" },
    ];
    const target = sentenceTileDistractorTarget(longAnswer.length);
    assert.equal(target, 2);
    const picked = selectSentenceTileDistractors(longAnswer, deck, target);
    assert.deepEqual(
      picked.map((part) => part.gurmukhi),
      ["ਪੰਜ"]
    );
  });

  it("tops up to the target from later unique words after duplicates", () => {
    const longAnswer = ["ਹੁਣ", "ਕਿੰਨੇ", "ਵਜੇ", "ਨੇ?"];
    const deck = [
      { gurmukhi: "ਦੋ", romanised: "Do" },
      { gurmukhi: "ਦੋ", romanised: "Do" },
      { gurmukhi: "ਤਿੰਨ", romanised: "Tinn" },
      { gurmukhi: "ਚਾਰ", romanised: "Chaar" },
    ];
    const picked = selectSentenceTileDistractors(
      longAnswer,
      deck,
      sentenceTileDistractorTarget(longAnswer.length)
    );
    assert.deepEqual(
      picked.map((part) => part.gurmukhi),
      ["ਦੋ", "ਤਿੰਨ"]
    );
  });
});

describe("gurmukhiSequenceMatches", () => {
  it("accepts the answer by word sequence, including trailing punctuation", () => {
    assert.equal(
      gurmukhiSequenceMatches(["ਕਿੰਨੇ", "ਵਜੇ", "ਨੇ?"], ["ਕਿੰਨੇ", "ਵਜੇ", "ਨੇ?"]),
      true
    );
    assert.equal(
      gurmukhiSequenceMatches(["ਕਿੰਨੇ", "ਵਜੇ", "ਨੇ"], ["ਕਿੰਨੇ", "ਵਜੇ", "ਨੇ?"]),
      true
    );
  });

  it("rejects a different order or a different word", () => {
    assert.equal(
      gurmukhiSequenceMatches(["ਵਜੇ", "ਕਿੰਨੇ", "ਨੇ?"], ["ਕਿੰਨੇ", "ਵਜੇ", "ਨੇ?"]),
      false
    );
    assert.equal(
      gurmukhiSequenceMatches(["ਕਿੰਨੇ", "ਦੋ", "ਨੇ?"], ["ਕਿੰਨੇ", "ਵਜੇ", "ਨੇ?"]),
      false
    );
  });
});
