import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTutorCohortSwitchNotifyEmail } from "./cohort-switch-tutor-notify";

describe("buildTutorCohortSwitchNotifyEmail", () => {
  it("includes student, week, topic, and a reply prompt", () => {
    const email = buildTutorCohortSwitchNotifyEmail({
      studentName: "Amrit",
      weekNumber: 6,
      topic: "Past tense & daily routine",
      cohortName: "Cohort 39",
      sessionWhen: "Thu 18 Sep, 18:00–19:00",
    });

    assert.equal(email.subject, "Reschedule: Amrit is joining your Week 6 session");
    assert.match(email.text, /Amrit is joining your Week 6 session as part of a reschedule/);
    assert.match(email.text, /They're expecting to cover: Past tense & daily routine\./);
    assert.match(email.text, /please reply to this email/);
    assert.match(email.text, /Cohort: Cohort 39/);
    assert.match(email.html, /Past tense &amp; daily routine/);
    assert.equal(email.text.includes("—"), false);
    assert.equal(email.subject.includes("—"), false);
  });

  it("handles missing week and topic without inventing values", () => {
    const email = buildTutorCohortSwitchNotifyEmail({
      studentName: "Amrit",
      weekNumber: null,
      topic: null,
      cohortName: null,
      sessionWhen: null,
    });

    assert.equal(email.subject, "Reschedule: Amrit is joining your session");
    assert.match(email.text, /Amrit is joining your session as part of a reschedule/);
    assert.match(email.text, /isn't listed on this session yet/);
    assert.equal(email.text.includes("They're expecting to cover:"), false);
  });
});
