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

test("clearing cover removes the Notion tutor and can leave attendees untouched", () => {
  const properties = lessonLogEditNotionProperties({
    recordingUrl: null,
    isCoverSession: false,
    notionTutorUserId: "tutor-1",
    attendeeLeadIds: null,
  });
  assert.deepEqual(properties["Cover Session?"], { checkbox: false });
  assert.deepEqual(properties["Actual Tutor (New)"], { people: [] });
  assert.equal(properties["Recording Link"] && (properties["Recording Link"] as { url: string | null }).url, null);
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
