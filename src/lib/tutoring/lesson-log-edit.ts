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
  title?: string | null;
  lessonDate?: string | null;
  notes?: string | null;
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
      people: input.notionTutorUserId?.trim() ? [{ id: input.notionTutorUserId.trim() }] : [],
    },
  };
  if (input.title?.trim()) {
    properties.Lesson = {
      title: [{ type: "text", text: { content: input.title.trim().slice(0, 2000) } }],
    };
  }
  if (input.lessonDate?.trim()) {
    properties["Lesson Date"] = { date: { start: input.lessonDate.trim() } };
  }
  if (input.notes !== undefined) {
    const note = input.notes?.trim() ?? "";
    properties.notes = {
      rich_text: note ? [{ type: "text", text: { content: note.slice(0, 2000) } }] : [],
    };
  }
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
