import "server-only";

import { NOTION_LEADS_DATA_SOURCE_ID, notionJson, relationIds } from "@/lib/notion/client";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Lessons Log relation → Leads (drives Attendance % / payroll formulas). */
export const LESSON_LOG_ATTENDEES_PROPERTY = "Attendees";
/** Lessons Log relation → Leads (drives Homework %). */
export const LESSON_LOG_HOMEWORK_PROPERTY = "Homework";

export type LessonLogStudentLeadMatch =
  | { studentId: string; studentName: string; ok: true; leadPageId: string }
  | {
      studentId: string;
      studentName: string;
      ok: false;
      reason: "missing_app_user_id";
    };

function notionPageIdsEqual(a: string, b: string): boolean {
  return a.replace(/-/g, "").toLowerCase() === b.replace(/-/g, "").toLowerCase();
}

function uniqueNotionIds(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (!out.some((existing) => notionPageIdsEqual(existing, id))) {
      out.push(id);
    }
  }
  return out;
}

/**
 * Resolve Notion Lead page for a profile via App User ID (not email create).
 * Uses profiles.notion_lead_page_id when set; otherwise queries Leads by App User ID.
 * Does not create leads — missing App User ID is a data-linking gap to surface.
 */
export async function resolveLeadPageIdByAppUserId(
  supabase: SupabaseClient,
  profileId: string
): Promise<{ ok: true; leadPageId: string } | { ok: false }> {
  const id = profileId.trim();
  if (!id) return { ok: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("notion_lead_page_id")
    .eq("id", id)
    .maybeSingle();

  if (profile?.notion_lead_page_id?.trim()) {
    return { ok: true, leadPageId: profile.notion_lead_page_id.trim() };
  }

  const result = await notionJson<{
    results?: Array<{ id?: string }>;
  }>(`/databases/${NOTION_LEADS_DATA_SOURCE_ID}/query`, {
    method: "POST",
    body: JSON.stringify({
      filter: {
        property: "App User ID",
        rich_text: { equals: id },
      },
      page_size: 5,
    }),
  });

  const pageIds = (result.results ?? [])
    .map((row) => row.id?.trim())
    .filter((value): value is string => Boolean(value));

  if (pageIds.length !== 1) {
    return { ok: false };
  }

  const leadPageId = pageIds[0]!;
  await supabase
    .from("profiles")
    .update({ notion_lead_page_id: leadPageId })
    .eq("id", id)
    .is("notion_lead_page_id", null);

  return { ok: true, leadPageId };
}

export async function matchStudentsToNotionLeads(
  supabase: SupabaseClient,
  students: Array<{ studentId: string; studentName: string }>
): Promise<LessonLogStudentLeadMatch[]> {
  const matches: LessonLogStudentLeadMatch[] = [];
  for (const student of students) {
    const resolved = await resolveLeadPageIdByAppUserId(supabase, student.studentId);
    if (resolved.ok) {
      matches.push({
        studentId: student.studentId,
        studentName: student.studentName,
        ok: true,
        leadPageId: resolved.leadPageId,
      });
    } else {
      matches.push({
        studentId: student.studentId,
        studentName: student.studentName,
        ok: false,
        reason: "missing_app_user_id",
      });
    }
  }
  return matches;
}

async function readLessonLogRelationIds(
  notionPageId: string,
  property: string
): Promise<string[]> {
  const page = await notionJson<{ properties: Record<string, unknown> }>(
    `/pages/${notionPageId}`
  );
  const prop = page.properties[property] as
    | { relation?: Array<{ id?: string }> }
    | undefined;
  return relationIds(prop);
}

/**
 * Replace Attendees and/or Homework relations on a Lessons Log Notion page.
 * Full array replace so absences / incomplete homework remove Lead pages.
 */
export async function pushLessonLogAttendanceHomeworkToNotion(options: {
  notionPageId: string;
  attendeeLeadPageIds: string[];
  homeworkLeadPageIds: string[];
  updateAttendees: boolean;
  updateHomework: boolean;
}): Promise<void> {
  const properties: Record<string, { relation: Array<{ id: string }> }> = {};

  if (options.updateAttendees) {
    properties[LESSON_LOG_ATTENDEES_PROPERTY] = {
      relation: uniqueNotionIds(options.attendeeLeadPageIds).map((id) => ({ id })),
    };
  }
  if (options.updateHomework) {
    properties[LESSON_LOG_HOMEWORK_PROPERTY] = {
      relation: uniqueNotionIds(options.homeworkLeadPageIds).map((id) => ({ id })),
    };
  }

  if (Object.keys(properties).length === 0) return;

  await notionJson(`/pages/${options.notionPageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
}

export async function readLessonLogAttendanceHomeworkFromNotion(
  notionPageId: string
): Promise<{ attendeeLeadIds: string[]; homeworkLeadIds: string[] }> {
  const [attendeeLeadIds, homeworkLeadIds] = await Promise.all([
    readLessonLogRelationIds(notionPageId, LESSON_LOG_ATTENDEES_PROPERTY),
    readLessonLogRelationIds(notionPageId, LESSON_LOG_HOMEWORK_PROPERTY),
  ]);
  return { attendeeLeadIds, homeworkLeadIds };
}
