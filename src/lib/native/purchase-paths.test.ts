import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isNativePurchasePath, nativePurchaseRedirect } from "./purchase-paths";

describe("native purchase paths", () => {
  it("sends signup to login and checkout to the dashboard", () => {
    assert.equal(nativePurchaseRedirect("/signup"), "/login");
    assert.equal(nativePurchaseRedirect("/signup/check-email"), "/login");
    assert.equal(nativePurchaseRedirect("/checkout/success"), "/dashboard");
    assert.equal(nativePurchaseRedirect("/courses/foundational"), "/dashboard");
    assert.equal(nativePurchaseRedirect("/dashboard/membership/premium"), "/dashboard");
    assert.equal(nativePurchaseRedirect("/book-call"), "/dashboard");
    assert.equal(nativePurchaseRedirect("/dashboard/profile/billing"), "/dashboard");
    assert.equal(nativePurchaseRedirect("/how-it-works"), "/dashboard");
  });

  it("leaves learning routes alone", () => {
    assert.equal(isNativePurchasePath("/dashboard/learn"), false);
    assert.equal(nativePurchaseRedirect("/login"), null);
    assert.equal(nativePurchaseRedirect("/forgot-password"), null);
    assert.equal(nativePurchaseRedirect("/auth/callback"), null);
  });
});
