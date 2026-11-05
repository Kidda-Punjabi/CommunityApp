import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENDING_QUESTIONS, endingsForLevel, endingsForWeek, startsWithAttachedSign } from "./endings-bank";

describe("endings bank", () => {
  it("has questions for every level from 1 to 8", () => {
    for (let level = 1; level <= 8; level += 1) assert.ok(endingsForLevel(level).length >= 20, `level ${level}`);
  });
  it("covers the Beginners weeks with endings", () => {
    for (const week of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) assert.ok(endingsForWeek(week).length > 0, `week ${week}`);
  });
  it("includes questions with several gaps", () => {
    assert.ok(ENDING_QUESTIONS.filter((q) => q.answers.length > 1).length >= 50);
  });
  for (const q of ENDING_QUESTIONS) {
    it(`${q.id} is well formed: ${q.english}`, () => {
      const gaps = q.parts.filter((p) => "gap" in p).length;
      assert.equal(gaps, q.answers.length);
      assert.equal(q.romanParts.filter((p) => "gap" in p).length, gaps);
      for (const a of q.answers) assert.ok(q.cards.some((c) => c.g === a.g), `missing card ${a.g}`);
      assert.equal(new Set(q.cards.map((c) => c.g)).size, q.cards.length);
      assert.ok(q.cards.length >= 4 && q.cards.length <= 6);
      assert.ok(!/[\[\]]/.test(q.gurmukhi + q.romanised));
      assert.ok(!/—/.test(q.english));
    });
  }
  it("recognises endings that attach to the letter before", () => {
    assert.equal(startsWithAttachedSign("ਂਦਾ"), true);
    assert.equal(startsWithAttachedSign("ਿਆ"), true);
    assert.equal(startsWithAttachedSign("ਦਾ"), false);
  });
});
