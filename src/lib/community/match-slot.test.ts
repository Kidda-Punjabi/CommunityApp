import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchCommunitySlot } from "./match-slot";

describe("matchCommunitySlot", () => {
  it("splits the shared UK title by weekday", () => {
    assert.equal(
      matchCommunitySlot("Kidda Community Class", "2026-10-18T09:00:00Z"),
      "uk-sun"
    );
    assert.equal(
      matchCommunitySlot("Kidda Community Class", "2026-10-21T18:00:00Z"),
      "uk-wed"
    );
  });

  it("matches the regional titles exactly", () => {
    assert.equal(
      matchCommunitySlot(
        "Kidda Community Class - Australia (Wed, Sydney/Melbourne)",
        "2026-11-11T08:00:00Z"
      ),
      "au-wed"
    );
    assert.equal(
      matchCommunitySlot(
        "Kidda Community Class - Canada (Sat, Toronto)",
        "2026-12-05T15:00:00Z"
      ),
      "ca-sat"
    );
  });

  it("ignores cohort classes and taster sessions", () => {
    assert.equal(
      matchCommunitySlot("Kidda Class - Cohort 38", "2026-10-19T18:00:00Z"),
      null
    );
    assert.equal(
      matchCommunitySlot(
        "Arsh // Mandeep - Community Taster Session",
        "2026-10-19T18:00:00Z"
      ),
      null
    );
  });
});
