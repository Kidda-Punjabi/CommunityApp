import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RESCHEDULE_INVITE_MARKER,
  buildRescheduleInviteNote,
  formatCohortWeekLabel,
  mergeCalendarInviteDescription,
} from "./cohort-switch-invite-copy";

describe("formatCohortWeekLabel", () => {
  it("joins cohort name and week", () => {
    assert.equal(formatCohortWeekLabel("Cohort 39", 4), "Cohort 39 · Week 4");
  });

  it("omits missing parts", () => {
    assert.equal(formatCohortWeekLabel("Cohort 39", null), "Cohort 39");
    assert.equal(formatCohortWeekLabel(null, 4), "Week 4");
    assert.equal(formatCohortWeekLabel("  ", null), "");
  });
});

describe("buildRescheduleInviteNote", () => {
  it("includes cohort, week, and join link", () => {
    const note = buildRescheduleInviteNote({
      cohortName: "Cohort 39",
      weekNumber: 6,
      joinLink: "https://meet.google.com/abc-defg-hij",
    });
    assert.match(note, new RegExp(RESCHEDULE_INVITE_MARKER));
    assert.match(note, /Cohort 39 · Week 6/);
    assert.match(note, /Use the link below to join:/);
    assert.match(note, /https:\/\/meet\.google\.com\/abc-defg-hij/);
  });

  it("falls back when the join link is missing", () => {
    const note = buildRescheduleInviteNote({
      cohortName: "Cohort 39",
      weekNumber: 6,
      joinLink: null,
    });
    assert.match(note, /Use the join link on this calendar event/);
    assert.equal(note.includes("https://"), false);
  });
});

describe("mergeCalendarInviteDescription", () => {
  it("preserves existing description and appends the reschedule note", () => {
    const merged = mergeCalendarInviteDescription(
      "Weekly Beginners class.",
      buildRescheduleInviteNote({
        cohortName: "Cohort 39",
        weekNumber: 6,
        joinLink: "https://meet.google.com/abc-defg-hij",
      })
    );
    assert.match(merged, /^Weekly Beginners class\./);
    assert.match(merged, new RegExp(RESCHEDULE_INVITE_MARKER));
    assert.match(merged, /https:\/\/meet\.google\.com\/abc-defg-hij/);
  });

  it("replaces a previous reschedule note instead of duplicating it", () => {
    const first = mergeCalendarInviteDescription(
      "Keep this intro.",
      buildRescheduleInviteNote({
        cohortName: "Cohort 39",
        weekNumber: 5,
        joinLink: "https://meet.google.com/old-link",
      })
    );
    const second = mergeCalendarInviteDescription(
      first,
      buildRescheduleInviteNote({
        cohortName: "Cohort 39",
        weekNumber: 6,
        joinLink: "https://meet.google.com/new-link",
      })
    );
    assert.equal(second.includes("https://meet.google.com/old-link"), false);
    assert.match(second, /^Keep this intro\./);
    assert.match(second, /Week 6/);
    assert.match(second, /https:\/\/meet\.google\.com\/new-link/);
    assert.equal(second.split(RESCHEDULE_INVITE_MARKER).length - 1, 1);
  });
});
