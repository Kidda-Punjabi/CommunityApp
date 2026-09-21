import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildIssueReportEmail, escapeHtml } from "./email";

describe("escapeHtml", () => {
  it("escapes user-supplied markup", () => {
    assert.equal(
      escapeHtml(`<script>alert("x")</script>`),
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );
  });
});

describe("buildIssueReportEmail", () => {
  it("uses the area label in the subject and escapes the description in HTML", () => {
    const built = buildIssueReportEmail({
      area: "homework",
      fullName: "Test Parent",
      email: "parent@example.com",
      description: "Broken <b>upload</b>",
      pageUrl: "https://webapp.kidda.app/dashboard/learn",
      userAgent: "Mozilla/5.0",
      submittedAt: "2026-09-21T09:00:00.000Z",
      attachments: [{ name: "shot.png", url: "https://example.com/a?x=1&y=2" }],
    });

    assert.equal(built.subject, "[Kidda issue] Homework from Test Parent");
    assert.match(built.html, /Broken &lt;b&gt;upload&lt;\/b&gt;/);
    assert.match(built.html, /href="https:\/\/example.com\/a\?x=1&amp;y=2"/);
    assert.match(built.text, /Area: Homework/);
    assert.match(built.text, /Admin: /);
  });
});
