export type LessonLogEditAttendance = {
  id: string;
  name: string;
  kind: "student" | "kid";
  attended: boolean;
};

/** Properties written onto an existing Notion lesson log when a tutor edits it. */
export function lessonLogEditNotionProperties(input: {
  recordingUrl: string | null;
  isCoverSession: boolean;
  notionTutorUserId: string | null;
  attendeeLeadIds: string[] | null;
}): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    "Recording Link": { url: input.recordingUrl },
    "Cover Session?": { checkbox: input.isCoverSession },
    "Actual Tutor (New)": {
      people:
        input.isCoverSession && input.notionTutorUserId?.trim()
          ? [{ id: input.notionTutorUserId.trim() }]
          : [],
    },
  };
  if (input.attendeeLeadIds) {
    properties.Attendees = {
      relation: input.attendeeLeadIds.map((id) => ({ id })),
    };
  }
  return properties;
}
