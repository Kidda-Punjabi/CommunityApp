import "server-only";

import {
  NOTION_LEADS_DATA_SOURCE_ID,
  NOTION_LESSONS_LOG_DATA_SOURCE_ID,
  notionJson,
  relationIds,
} from "@/lib/notion/client";
import {
  LEADS_APP_USER_ID_PROPERTY,
  LEADS_KID_PROFILE_ID_PROPERTY,
  classifyLookupCount,
  uniqueNotionIds,
} from "@/lib/notion/attendance-homework-writeback-logic";
import { matchStudentsToNotionLeads } from "@/lib/notion/lesson-log-attendance-sync";
import type { LessonLogReadback } from "@/lib/tutoring/log-lesson-copy";
import { lessonLogEditNotionProperties } from "@/lib/tutoring/lesson-log-edit";
import type { SupabaseClient } from "@supabase/supabase-js";

type NotionProperty = {
  type?: string;
  title?: Array<{ plain_text?: string }>;
  url?: string | null;
  date?: { start?: string | null } | null;
  relation?: Array<{ id?: string }>;
  has_more?: boolean;
  people?: Array<{ id?: string; name?: string }>;
  checkbox?: boolean;
};

type NotionPage = {
  id: string;
  url?: string;
  properties: Record<string, NotionProperty>;
};

export type PresentStudent = {
  studentId: string | null;
  kidProfileId: string | null;
  name: string;
};

function plainText(parts: Array<{ plain_text?: string }> | undefined): string {
  return (parts ?? []).map((part) => part.plain_text ?? "").join("").trim();
}

function titleOf(properties: Record<string, NotionProperty> | undefined): string {
  if (!properties) return "";
  const named = properties.Lesson;
  if (named?.type === "title") return plainText(named.title);
  for (const prop of Object.values(properties)) {
    if (prop?.type === "title") return plainText(prop.title);
  }
  return "";
}

export function notionPageUrl(pageId: string): string {
  return `https://notion.so/${pageId.replace(/-/g, "")}`;
}

export async function createLessonLogPage(options: {
  title: string;
  lessonDate: string;
  packageNotionPageId: string;
  notes: string | null;
  recordingUrl: string | null;
  notionTutorUserId: string | null;
  isCoverSession: boolean;
}): Promise<string> {
  const properties: Record<string, unknown> = {
    Lesson: {
      title: [{ type: "text", text: { content: options.title.slice(0, 2000) } }],
    },
    "Lesson Date": { date: { start: options.lessonDate } },
    "New Package DB": { relation: [{ id: options.packageNotionPageId }] },
    Status: { select: { name: "Completed" } },
    Reviewed: { checkbox: false },
    "Cover Session?": { checkbox: Boolean(options.isCoverSession) },
  };
  if (options.notes?.trim()) {
    properties.notes = {
      rich_text: [{ type: "text", text: { content: options.notes.trim().slice(0, 2000) } }],
    };
  }
  if (options.recordingUrl?.trim()) {
    properties["Recording Link"] = { url: options.recordingUrl.trim() };
  }
  if (options.notionTutorUserId?.trim()) {
    properties["Actual Tutor (New)"] = {
      people: [{ id: options.notionTutorUserId.trim() }],
    };
  }

  const created = await notionJson<{ id: string }>("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: NOTION_LESSONS_LOG_DATA_SOURCE_ID },
      properties,
    }),
  });
  return created.id;
}

async function readRelation(pageId: string, property: string): Promise<string[]> {
  const page = await notionJson<NotionPage>(`/pages/${pageId}`);
  return relationIds(page.properties?.[property]);
}

/** Append lead pages onto Attendees. Existing relation entries stay. */
export async function appendAttendeeRelation(
  pageId: string,
  leadPageIds: string[]
): Promise<{ before: string[]; after: string[] }> {
  const before = await readRelation(pageId, "Attendees");
  const after = uniqueNotionIds([...before, ...leadPageIds]);
  const changed = after.length !== uniqueNotionIds(before).length;
  if (changed) {
    await notionJson(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({
        archived: false,
        properties: {
          Attendees: { relation: after.map((id) => ({ id })) },
        },
      }),
    });
  }
  const confirmed = await readRelation(pageId, "Attendees");
  return { before, after: confirmed };
}

async function queryLeadIds(property: string, value: string): Promise<string[]> {
  const data = await notionJson<{ results?: Array<{ id?: string }> }>(
    `/databases/${NOTION_LEADS_DATA_SOURCE_ID}/query`,
    {
      method: "POST",
      body: JSON.stringify({
        filter: { property, rich_text: { equals: value } },
        page_size: 5,
      }),
    }
  );
  return uniqueNotionIds(
    (data.results ?? []).map((row) => row.id ?? "").filter((id) => id.length > 0)
  );
}

export async function resolvePresentLeads(
  supabase: SupabaseClient,
  present: PresentStudent[]
): Promise<{
  leadIds: string[];
  unmatchedNames: string[];
  nameByLeadId: Map<string, string>;
}> {
  const leadIds: string[] = [];
  const unmatchedNames: string[] = [];
  const nameByLeadId = new Map<string, string>();

  const adults = present.filter((student) => student.studentId && !student.kidProfileId);
  const adultMatches = adults.length
    ? await matchStudentsToNotionLeads(
        supabase,
        adults.map((student) => ({
          studentId: student.studentId!,
          studentName: student.name,
        }))
      )
    : [];
  const adultById = new Map(adultMatches.map((match) => [match.studentId, match]));

  for (const student of present) {
    if (student.kidProfileId) {
      const ids = await queryLeadIds(LEADS_KID_PROFILE_ID_PROPERTY, student.kidProfileId);
      if (classifyLookupCount(ids) === "one") {
        leadIds.push(ids[0]!);
        nameByLeadId.set(ids[0]!, student.name);
        continue;
      }
      const parentMatches = await matchStudentsToNotionLeads(supabase, [
        { studentId: student.kidProfileId, studentName: student.name },
      ]);
      const parent = parentMatches[0];
      if (parent?.ok) {
        leadIds.push(parent.leadPageId);
        nameByLeadId.set(parent.leadPageId, student.name);
        continue;
      }
      unmatchedNames.push(student.name);
      continue;
    }

    const match = student.studentId ? adultById.get(student.studentId) : undefined;
    if (match && match.ok) {
      leadIds.push(match.leadPageId);
      nameByLeadId.set(match.leadPageId, student.name);
    } else if (student.studentId) {
      const ids = await queryLeadIds(LEADS_APP_USER_ID_PROPERTY, student.studentId);
      if (classifyLookupCount(ids) === "one") {
        leadIds.push(ids[0]!);
        nameByLeadId.set(ids[0]!, student.name);
      } else {
        unmatchedNames.push(student.name);
      }
    } else {
      unmatchedNames.push(student.name);
    }
  }

  return { leadIds: uniqueNotionIds(leadIds), unmatchedNames, nameByLeadId };
}

async function leadName(pageId: string): Promise<string> {
  const page = await notionJson<NotionPage>(`/pages/${pageId}`);
  return titleOf(page.properties) || "Student";
}

async function tutorLabel(userId: string): Promise<string> {
  try {
    const user = await notionJson<{ name?: string }>(`/users/${userId}`);
    return user.name?.trim() || "";
  } catch {
    return "";
  }
}

export async function readLessonLogPage(options: {
  pageId: string;
  expectedTutorUserId: string | null;
  absentNames: string[];
}): Promise<LessonLogReadback> {
  const page = await notionJson<NotionPage>(`/pages/${options.pageId}`);
  const properties = page.properties ?? {};
  const title = titleOf(properties);
  const dateRaw = properties["Lesson Date"]?.date?.start ?? "";
  const date = dateRaw.slice(0, 10);
  const recordingUrl = properties["Recording Link"]?.url?.trim() ?? "";
  const attendeeIds = relationIds(properties.Attendees);
  const attendeeNames: string[] = [];
  for (const id of attendeeIds) {
    attendeeNames.push(await leadName(id));
  }
  const people = properties["Actual Tutor (New)"]?.people ?? [];
  const tutorId = people[0]?.id?.trim() ?? "";
  const tutorName = people[0]?.name?.trim() || (tutorId ? await tutorLabel(tutorId) : "");
  const expected = options.expectedTutorUserId?.replace(/-/g, "").toLowerCase() ?? "";
  const actual = tutorId.replace(/-/g, "").toLowerCase();
  const tutorMatched = expected.length === 0 ? actual.length === 0 : actual === expected;
  const coverSession = Boolean(properties["Cover Session?"]?.checkbox);

  return {
    title,
    date,
    lesson: title,
    recordingUrl,
    attendeeNames,
    attendeeLeadIds: attendeeIds,
    absentNames: options.absentNames,
    tutorName,
    tutorMatched,
    coverSession,
    notionUrl: page.url || notionPageUrl(options.pageId),
  };
}

export async function patchLessonLogRecording(pageId: string, url: string): Promise<void> {
  await notionJson(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({
      properties: {
        "Recording Link": { url },
      },
    }),
  });
}

/** Update recording, cover tutor, and attendees on the lesson log page that already exists. */
export async function patchLoggedLessonOnNotion(options: {
  pageId: string;
  recordingUrl: string | null;
  isCoverSession: boolean;
  notionTutorUserId: string | null;
  attendeeLeadIds: string[] | null;
  homeworkLeadIds?: string[] | null;
}): Promise<void> {
  await notionJson(`/pages/${options.pageId}`, {
    method: "PATCH",
    body: JSON.stringify({
      archived: false,
      properties: lessonLogEditNotionProperties(options),
    }),
  });
}
