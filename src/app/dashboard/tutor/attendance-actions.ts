"use server";

import { createClient } from "@/lib/supabase/server";
import {
  loadCohortAttendanceLessons,
  loadCohortAttendanceRoster,
  loadLessonsWithAttendanceMarked,
  type CohortAttendanceLessonOption,
  type CohortAttendanceRosterStudent,
} from "@/lib/tutoring/cohort-attendance";
import { canAccessTutorDashboard, canManageCohort } from "@/lib/tutoring/tutor-access";
import { revalidatePath } from "next/cache";

export type AttendanceActionResult = {
  error?: string;
  success?: string;
};

export type AttendanceLessonContext = {
  lessons: CohortAttendanceLessonOption[];
  markedLessonIds: string[];
};

export type AttendanceRosterContext = {
  roster: CohortAttendanceRosterStudent[];
};

async function requireTutorAttendanceAction(cohortId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("You must be signed in.");

  const allowed = await canAccessTutorDashboard(supabase, user.id);
  if (!allowed) throw new Error("Tutor access required.");

  const canManage = await canManageCohort(supabase, user.id, cohortId);
  if (!canManage) throw new Error("You are not the tutor for this cohort.");

  return { supabase, userId: user.id };
}

export async function loadAttendanceLessons(
  cohortId: string,
  courseId: string
): Promise<AttendanceActionResult & AttendanceLessonContext> {
  try {
    const { supabase } = await requireTutorAttendanceAction(cohortId);
    const [lessons, markedLessonIds] = await Promise.all([
      loadCohortAttendanceLessons(supabase, cohortId, courseId),
      loadLessonsWithAttendanceMarked(supabase, cohortId),
    ]);

    return {
      lessons,
      markedLessonIds: [...markedLessonIds],
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to load lessons.",
      lessons: [],
      markedLessonIds: [],
    };
  }
}

export async function loadAttendanceRoster(
  cohortId: string,
  lessonId: string
): Promise<AttendanceActionResult & AttendanceRosterContext> {
  try {
    const { supabase } = await requireTutorAttendanceAction(cohortId);
    const roster = await loadCohortAttendanceRoster(supabase, cohortId, lessonId);
    return { roster };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to load roster.",
      roster: [],
    };
  }
}

export type AttendanceMarkInput = {
  studentId: string;
  attended: boolean;
};

export async function saveCohortLessonAttendance(
  cohortId: string,
  lessonId: string,
  marks: AttendanceMarkInput[]
): Promise<AttendanceActionResult> {
  try {
    const { supabase, userId } = await requireTutorAttendanceAction(cohortId);

    if (marks.length === 0) {
      return { error: "Mark at least one student before saving." };
    }

    const now = new Date().toISOString();
    const rows = marks.map((mark) => ({
      cohort_id: cohortId,
      lesson_id: lessonId,
      student_id: mark.studentId,
      attended: mark.attended,
      marked_by: userId,
      marked_at: now,
      updated_at: now,
    }));

    const { error } = await supabase.from("cohort_lesson_attendance").upsert(rows, {
      onConflict: "cohort_id,lesson_id,student_id",
    });

    if (error) return { error: error.message };

    revalidatePath("/dashboard/tutor");
    revalidatePath("/dashboard/tutor/attendance");
    return { success: `Attendance saved for ${marks.length} student${marks.length === 1 ? "" : "s"}.` };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to save attendance.",
    };
  }
}
