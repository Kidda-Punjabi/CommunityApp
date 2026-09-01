"use server";

import { createClient } from "@/lib/supabase/server";
import {
  kidProfileIdsInCohort,
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
  warning?: string;
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

    const kidIds = await kidProfileIdsInCohort(supabase, cohortId);

    const now = new Date().toISOString();
    const adultMarks = marks.filter((mark) => !kidIds.has(mark.studentId));
    const kidMarks = marks.filter((mark) => kidIds.has(mark.studentId));

    if (adultMarks.length > 0) {
      const { error } = await supabase.from("cohort_lesson_attendance").upsert(
        adultMarks.map((mark) => ({
          cohort_id: cohortId,
          lesson_id: lessonId,
          student_id: mark.studentId,
          kid_profile_id: null,
          attended: mark.attended,
          marked_by: userId,
          marked_at: now,
          updated_at: now,
        })),
        { onConflict: "cohort_id,lesson_id,student_id" }
      );
      if (error) return { error: error.message };
    }

    if (kidMarks.length > 0) {
      const { error } = await supabase.from("cohort_lesson_attendance").upsert(
        kidMarks.map((mark) => ({
          cohort_id: cohortId,
          lesson_id: lessonId,
          student_id: null,
          kid_profile_id: mark.studentId,
          attended: mark.attended,
          marked_by: userId,
          marked_at: now,
          updated_at: now,
        })),
        { onConflict: "cohort_id,lesson_id,kid_profile_id" }
      );
      if (error) return { error: error.message };
    }

    // Best-effort Notion Attendees push when a matching Lessons Log entry exists.
    let notionSyncSuccess = false;
    let notionWarning: string | null = null;
    
    try {
      const { createServiceRoleClient } = await import("@/lib/supabase/admin-server");
      const admin = createServiceRoleClient();
      const { data: lesson } = await admin
        .from("lessons")
        .select("lesson_number")
        .eq("id", lessonId)
        .maybeSingle();
      const lessonNumber = Number(lesson?.lesson_number) || 0;

      const { isCountableLessonLogStatus } = await import(
        "@/lib/lessons/lesson-log-progress"
      );
      const { data: logRows } = await admin
        .from("cohort_lesson_log_entries")
        .select("id, notion_page_id, status, lesson_date, lesson_id")
        .eq("cohort_id", cohortId)
        .order("lesson_date", { ascending: true })
        .order("id", { ascending: true });

      const countable = (logRows ?? []).filter((row) =>
        isCountableLessonLogStatus(row.status as string | null)
      );
      // Prefer the log row already linked to this curriculum lesson; fall back to
      // chronological position among non-cancelled entries (lesson N → index N-1).
      const matchedByLessonId = countable.find((row) => row.lesson_id === lessonId);
      const matched =
        matchedByLessonId ??
        (lessonNumber > 0 ? countable[lessonNumber - 1] ?? null : null);

      if (matched?.notion_page_id) {
        const {
          matchStudentsToNotionLeads,
          pushLessonLogAttendanceHomeworkToNotion,
          readLessonLogAttendanceHomeworkFromNotion,
        } = await import("@/lib/notion/lesson-log-attendance-sync");

        const { data: profiles } = await admin
          .from("profiles")
          .select("id, full_name, preferred_name")
          .in(
            "id",
            marks.map((m) => m.studentId)
          );
        const nameById = new Map(
          (profiles ?? []).map((profile) => {
            const name =
              (profile.preferred_name as string | null)?.trim() ||
              (profile.full_name as string | null)?.trim() ||
              "Student";
            return [profile.id as string, name] as const;
          })
        );

        const leadMatches = await matchStudentsToNotionLeads(
          admin,
          marks.map((mark) => ({
            studentId: mark.studentId,
            studentName: nameById.get(mark.studentId) ?? "Student",
          }))
        );
        const matchById = new Map(leadMatches.map((m) => [m.studentId, m]));
        const unmatched: string[] = [];
        const attendeeLeadPageIds: string[] = [];
        for (const mark of marks) {
          if (!mark.attended) continue;
          const match = matchById.get(mark.studentId);
          if (match?.ok) attendeeLeadPageIds.push(match.leadPageId);
          else unmatched.push(nameById.get(mark.studentId) ?? "Student");
        }

        // Preserve existing Homework relation; only replace Attendees.
        const existing = await readLessonLogAttendanceHomeworkFromNotion(
          matched.notion_page_id
        );
        await pushLessonLogAttendanceHomeworkToNotion({
          notionPageId: matched.notion_page_id,
          attendeeLeadPageIds,
          homeworkLeadPageIds: existing.homeworkLeadIds,
          updateAttendees: true,
          updateHomework: false,
        });

        notionSyncSuccess = true;
        
        if (unmatched.length > 0) {
          notionWarning = `Notion sync succeeded, but ${unmatched.length} student${unmatched.length === 1 ? "" : "s"} could not be matched: ${unmatched.join(", ")}. Their Notion Lead may be missing an App User ID.`;
        }
      } else {
        // No matching lesson log entry - this is expected for some lessons
        notionSyncSuccess = true;  // Not an error, just no log to sync to
      }
    } catch (notionError) {
      const errorMessage = notionError instanceof Error ? notionError.message : "Unknown error";
      notionWarning = `Notion sync failed: ${errorMessage}. Attendance is saved locally and will be retried automatically.`;
    }

    revalidatePath("/dashboard/tutor");
    revalidatePath("/dashboard/tutor/attendance");
    revalidatePath("/admin/lesson-log");
    
    if (notionWarning) {
      return {
        success: `Attendance saved locally for ${marks.length} student${marks.length === 1 ? "" : "s"}.`,
        warning: notionWarning,
      };
    }
    
    return {
      success: `Attendance saved and synced to Notion for ${marks.length} student${marks.length === 1 ? "" : "s"}.`,
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to save attendance.",
    };
  }
}
