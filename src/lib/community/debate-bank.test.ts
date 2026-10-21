import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEBATE_BANK } from "./debate-bank";

describe("DEBATE_BANK", () => {
  it("has 100 unique light prompts", () => {
    assert.equal(DEBATE_BANK.length, 100);
    assert.equal(new Set(DEBATE_BANK.map((item) => item.prompt)).size, 100);
    const banned = /\b(caste|religion|politics|money|salary|weight|skinny|fat)\b/i;
    for (const item of DEBATE_BANK) {
      assert.equal(banned.test(`${item.prompt} ${item.optionA} ${item.optionB}`), false, item.prompt);
      assert.ok(item.optionA && item.optionB);
    }
  });
});
