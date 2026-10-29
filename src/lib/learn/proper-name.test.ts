import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { properName } from "./proper-name";

describe("properName", () => {
  it("capitalises each part of a lowercase name", () => {
    assert.equal(properName("harpreet kaur"), "Harpreet Kaur");
  });
  it("handles hyphens and apostrophes", () => {
    assert.equal(properName("jean-luc o'neill"), "Jean-Luc O'Neill");
  });
  it("never lowercases letters the person typed as capitals", () => {
    assert.equal(properName("McDonald"), "McDonald");
    assert.equal(properName("aMAN"), "AMAN");
  });
  it("tidies spacing and leaves empty input empty", () => {
    assert.equal(properName("  simran   kaur "), "Simran Kaur");
    assert.equal(properName(null), "");
  });
});
