import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tierFromCheckoutKey } from "./checkout-tier";

describe("tierFromCheckoutKey", () => {
  it("keeps adult beginners keys on the beginners tier", () => {
    assert.equal(tierFromCheckoutKey("beginners"), "beginners");
    assert.equal(tierFromCheckoutKey("beginners-group"), "beginners");
    assert.equal(tierFromCheckoutKey("beginners-one-to-one"), "beginners");
  });

  it("does not map the kids group checkout onto adult beginners", () => {
    assert.equal(tierFromCheckoutKey("beginners-kids-group"), null);
  });
});
