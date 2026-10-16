import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isNativeAppRequest } from "./platform";

describe("isNativeAppRequest", () => {
  it("matches the Capacitor user agent token", () => {
    const headers = new Headers({
      "user-agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 KiddaApp/1.0",
    });
    assert.equal(isNativeAppRequest(headers), true);
  });

  it("does not match a normal browser", () => {
    const headers = new Headers({
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
    });
    assert.equal(isNativeAppRequest(headers), false);
  });
});
