export type LessonLogEditAttendance = {
  id: string;
  name: string;
  kind: "student" | "kid";
  attended: boolean;
};

/** People on this class who submitted homework for this same lesson. */
export function submittedHomeworkActorIds(
  rosterIds: string[],
  submissions: Array<{ actorId: string | null }>
): string[] {
  const roster = new Set(rosterIds);
  const submitted: string[] = [];
  for (const row of submissions) {
    const actorId = row.actorId?.trim() ?? "";
    if (!actorId || !roster.has(actorId) || submitted.includes(actorId)) continue;
    submitted.push(actorId);
  }
  return submitted;
}

/** Properties written onto an existing Notion lesson log when a tutor edits it. */
export function lessonLogEditNotionProperties(input: {
  recordingUrl: string | null;
  isCoverSession: boolean;
  notionTutorUserId: string | null;
  attendeeLeadIds: string[] | null;
  homeworkLeadIds?: string[] | null;
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
  if (input.homeworkLeadIds) {
    properties.Homework = {
      relation: input.homeworkLeadIds.map((id) => ({ id })),
    };
  }
  return properties;
}
