import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ParentKidProgressSummary = {
  kidProfileId: string;
  kidName: string;
  avatarIcon: string;
  courseId: string | null;
  courseName: string | null;
  courseLevel: string | null;
  currentLevelNumber: number | null;
  currentLevelLabel: string | null;
  currentWeek: number;
  totalWeeks: number;
  homeworkDone: number;
  homeworkDue: number;
  attendancePresent: number;
  attendanceTotal: number;
  outstandingHomeworkTitle: string | null;
  outstandingHomeworkDueAt: string | null;
  latestTutorNote: string | null;
  latestTutorNoteAt: string | null;
};

type RpcRow = {
  kid_profile_id: string;
  kid_name: string;
  avatar_icon: string | null;
  course_id: string | null;
  course_name: string | null;
  course_level: string | null;
  current_level_number: number | null;
  current_level_label: string | null;
  current_week: number | null;
  total_weeks: number | null;
  homework_done: number | null;
  homework_due: number | null;
  attendance_present: number | null;
  attendance_total: number | null;
  outstanding_homework_title: string | null;
  outstanding_homework_due_at: string | null;
  latest_tutor_note: string | null;
  latest_tutor_note_at: string | null;
};

function mapRow(row: RpcRow): ParentKidProgressSummary {
  return {
    kidProfileId: row.kid_profile_id,
    kidName: row.kid_name,
    avatarIcon: row.avatar_icon ?? "Star",
    courseId: row.course_id,
    courseName: row.course_name,
    courseLevel: row.course_level,
    currentLevelNumber: row.current_level_number,
    currentLevelLabel: row.current_level_label,
    currentWeek: row.current_week ?? 0,
    totalWeeks: row.total_weeks ?? 0,
    homeworkDone: row.homework_done ?? 0,
    homeworkDue: row.homework_due ?? 0,
    attendancePresent: row.attendance_present ?? 0,
    attendanceTotal: row.attendance_total ?? 0,
    outstandingHomeworkTitle: row.outstanding_homework_title,
    outstandingHomeworkDueAt: row.outstanding_homework_due_at,
    latestTutorNote: row.latest_tutor_note,
    latestTutorNoteAt: row.latest_tutor_note_at,
  };
}

export async function loadKidProgressSummary(
  supabase: SupabaseClient,
  kidProfileId: string
): Promise<ParentKidProgressSummary | null> {
  const { data, error } = await supabase.rpc("get_kid_progress_summary", {
    p_kid_profile_id: kidProfileId,
  });
  if (error) {
    console.error("[get_kid_progress_summary]", error.message);
    return null;
  }
  const row = Array.isArray(data) ? (data[0] as RpcRow | undefined) : (data as RpcRow | null);
  return row ? mapRow(row) : null;
}

export async function loadKidProgressSummariesForParent(
  supabase: SupabaseClient,
  parentUserId: string
): Promise<ParentKidProgressSummary[]> {
  const { data: kids } = await supabase
    .from("kid_profiles")
    .select("id")
    .eq("parent_user_id", parentUserId)
    .order("created_at", { ascending: true });

  if (!kids?.length) return [];

  const rows = await Promise.all(kids.map((kid) => loadKidProgressSummary(supabase, kid.id)));
  return rows.filter((row): row is ParentKidProgressSummary => row !== null);
}
