import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHECKIN_ALPHABET } from "./constants";
import { pickUnusedCode, takeCheckinChars } from "./checkin-code";

describe("takeCheckinChars", () => {
  it("keeps four alphabet characters and drops ambiguous ones", () => {
    assert.equal(takeCheckinChars("ab1i0o"), "AB");
    assert.equal(takeCheckinChars("k7m2extra"), "K7M2");
    assert.ok([...CHECKIN_ALPHABET].every((char) => takeCheckinChars(char) === char));
  });
});

describe("pickUnusedCode", () => {
  it("skips a code another live session already has", () => {
    const codes = ["AAAA", "BBBB", "CCCC"];
    const picked = pickUnusedCode(new Set(["AAAA"]), () => codes.shift() ?? "ZZZZ");
    assert.equal(picked, "BBBB");
  });
});
