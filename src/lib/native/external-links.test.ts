import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideLink } from "./external-links";

const ORIGIN = "https://webapp.kidda.app";

describe("decideLink", () => {
  it("keeps same-site navigation in the web view", () => {
    assert.equal(decideLink("/dashboard/learn", ORIGIN), "allow");
    assert.equal(decideLink("https://webapp.kidda.app/login", ORIGIN), "allow");
  });

  it("opens video calls and phone links with the system launcher", () => {
    assert.equal(decideLink("https://meet.google.com/abc-defg-hij", ORIGIN), "launcher");
    assert.equal(decideLink("https://zoom.us/j/123", ORIGIN), "launcher");
    assert.equal(decideLink("https://us02web.zoom.us/j/123", ORIGIN), "launcher");
    assert.equal(decideLink("https://teams.microsoft.com/l/meetup-join/abc", ORIGIN), "launcher");
    assert.equal(decideLink("mailto:hello@kidda.app", ORIGIN), "launcher");
    assert.equal(decideLink("tel:+441234567890", ORIGIN), "launcher");
    assert.equal(decideLink("intent:#Intent;action=android.intent.action.VIEW;end", ORIGIN), "launcher");
    assert.equal(decideLink("https://wa.me/441234567890", ORIGIN), "launcher");
  });

  it("opens other external sites in the in-app browser", () => {
    assert.equal(decideLink("https://www.canva.com/design/abc/view", ORIGIN), "browser");
    assert.equal(decideLink("https://www.youtube.com/watch?v=abc", ORIGIN), "browser");
    assert.equal(decideLink("https://kidda.app/about", ORIGIN), "browser");
  });

  it("shares downloads instead of navigating", () => {
    assert.equal(decideLink("blob:https://webapp.kidda.app/uuid", ORIGIN), "download");
    assert.equal(
      decideLink("https://webapp.kidda.app/api/certificates/beginner", ORIGIN, { download: true }),
      "download"
    );
  });
});
