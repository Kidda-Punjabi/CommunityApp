import assert from "node:assert/strict";
import test from "node:test";
import { lessonLogEditNotionProperties } from "./lesson-log-edit";

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
});
