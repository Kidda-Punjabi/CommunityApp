import assert from "node:assert/strict";
import test from "node:test";
import { lessonLogEditNotionProperties, submittedHomeworkActorIds } from "./lesson-log-edit";

test("a cover edit writes the teacher and the present leads", () => {
  const properties = lessonLogEditNotionProperties({
    recordingUrl: "https://example.com/rec",
    isCoverSession: true,
    notionTutorUserId: "tutor-1",
    attendeeLeadIds: ["lead-1"],
  });
  assert.deepEqual(properties["Cover Session?"], { checkbox: true });
  assert.deepEqual(properties["Actual Tutor (New)"], { people: [{ id: "tutor-1" }] });
  assert.deepEqual(properties.Attendees, { relation: [{ id: "lead-1" }] });
  assert.deepEqual(properties["Recording Link"], { url: "https://example.com/rec" });
});

test("a normal lesson still writes Actual Tutor when the teacher is mapped", () => {
  const properties = lessonLogEditNotionProperties({
    title: "Practice Cohort - Week 3 - 5 Oct (app)",
    lessonDate: "2026-10-05",
    notes: "",
    recordingUrl: null,
    isCoverSession: false,
    notionTutorUserId: "tutor-1",
    attendeeLeadIds: null,
  });
  assert.deepEqual(properties["Cover Session?"], { checkbox: false });
  assert.deepEqual(properties["Actual Tutor (New)"], { people: [{ id: "tutor-1" }] });
  assert.equal((properties.Lesson as { title: Array<{ text: { content: string } }> }).title[0]?.text.content, "Practice Cohort - Week 3 - 5 Oct (app)");
  assert.deepEqual(properties["Lesson Date"], { date: { start: "2026-10-05" } });
  assert.equal("Attendees" in properties, false);
});

test("clearing the tutor leaves Actual Tutor empty and can leave attendees untouched", () => {
  const properties = lessonLogEditNotionProperties({
    recordingUrl: null,
    isCoverSession: false,
    notionTutorUserId: null,
    attendeeLeadIds: null,
  });
  assert.deepEqual(properties["Actual Tutor (New)"], { people: [] });
  assert.equal("Attendees" in properties, false);
  assert.equal("Homework" in properties, false);
});

test("homework for this lesson is written onto the same Notion page", () => {
  assert.deepEqual(
    submittedHomeworkActorIds(
      ["gurupma", "other"],
      [{ actorId: "gurupma" }, { actorId: "someone-else" }, { actorId: "gurupma" }]
    ),
    ["gurupma"]
  );
  const properties = lessonLogEditNotionProperties({
    recordingUrl: null,
    isCoverSession: false,
    notionTutorUserId: null,
    attendeeLeadIds: ["lead-present"],
    homeworkLeadIds: ["lead-homework"],
  });
  assert.deepEqual(properties.Homework, { relation: [{ id: "lead-homework" }] });
  assert.deepEqual(properties.Attendees, { relation: [{ id: "lead-present" }] });
});
