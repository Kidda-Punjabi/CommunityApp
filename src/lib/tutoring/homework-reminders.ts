import type { SupabaseClient } from "@supabase/supabase-js";

type UnlockRow = {
  student_id: string;
  lesson_id: string;
  lesson: { id: string; title: string; lesson_number: number; course_id: string } | Array<{
    id: string;
    title: string;
    lesson_number: number;
    course_id: string;
  }> | null;
};

export type HomeworkDueReminder = {
  sessionId: string;
  lessonId: string;
  lessonTitle: string;
  nextLessonStartsAt: string;
};

function unwrapLesson(row: UnlockRow["lesson"]) {
  if (!row) return null;
  return Array.isArray(row) ? (row[0] ?? null) : row;
}

export async function loadHomeworkDueForStudent(
  supabase: SupabaseClient,
  studentId: string
): Promise<HomeworkDueReminder | null> {
  const now = new Date();
  const plus24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: nextSession } = await supabase
    .from("tutor_scheduled_sessions")
    .select("id, starts_at, course_id")
    .eq("student_id", studentId)
    .eq("status", "scheduled")
    .neq("match_method", "unmatched")
    .neq("match_method", "title_name")
    .gte("starts_at", now.toISOString())
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!nextSession?.course_id) return null;

  const { data: unlockRows } = await supabase
    .from("student_lesson_unlocks")
    .select("student_id, lesson_id, lesson:lesson_id(id, title, lesson_number, course_id)")
    .eq("student_id", studentId);

  const candidate = (unlockRows ?? [])
    .map((row) => {
      const lesson = unwrapLesson((row as UnlockRow).lesson);
      if (!lesson || lesson.course_id !== nextSession.course_id) return null;
      return { lessonId: lesson.id, lessonTitle: lesson.title, lessonNumber: lesson.lesson_number };
    })
    .filter((row): row is { lessonId: string; lessonTitle: string; lessonNumber: number } => Boolean(row))
    .sort((a, b) => b.lessonNumber - a.lessonNumber)[0];

  if (!candidate) return null;

  const { data: submission } = await supabase
    .from("homework_submissions")
    .select("id")
    .eq("student_id", studentId)
    .eq("lesson_id", candidate.lessonId)
    .maybeSingle();

  if (submission?.id) return null;

  // Show reminder in app any time before next lesson; separate cron handles 24h push.
  return {
    sessionId: nextSession.id as string,
    lessonId: candidate.lessonId,
    lessonTitle: candidate.lessonTitle,
    nextLessonStartsAt: nextSession.starts_at as string,
  };
}

export async function sendHomeworkDueReminders(
  supabase: SupabaseClient
): Promise<{ sent: number; scanned: number; errors: number }> {
  const now = new Date();
  const plus24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: sessions } = await supabase
    .from("tutor_scheduled_sessions")
    .select("id, student_id, course_id, starts_at")
    .eq("status", "scheduled")
    .neq("match_method", "unmatched")
    .neq("match_method", "title_name")
    .not("student_id", "is", null)
    .gte("starts_at", now.toISOString())
    .lte("starts_at", plus24h.toISOString())
    .order("starts_at", { ascending: true });

  const seenPair = new Set<string>();
  const targets: Array<{ sessionId: string; studentId: string; courseId: string; startsAt: string }> = [];
  for (const row of sessions ?? []) {
    const studentId = row.student_id as string | null;
    const courseId = row.course_id as string | null;
    if (!studentId || !courseId) continue;
    const key = `${studentId}:${courseId}`;
    if (seenPair.has(key)) continue;
    seenPair.add(key);
    targets.push({
      sessionId: row.id as string,
      studentId,
      courseId,
      startsAt: row.starts_at as string,
    });
  }

  let sent = 0;
  let errors = 0;

  for (const target of targets) {
    try {
      const { data: unlockRows } = await supabase
        .from("student_lesson_unlocks")
        .select("student_id, lesson_id, lesson:lesson_id(id, title, lesson_number, course_id)")
        .eq("student_id", target.studentId);

      const candidate = (unlockRows ?? [])
        .map((row) => {
          const lesson = unwrapLesson((row as UnlockRow).lesson);
          if (!lesson || lesson.course_id !== target.courseId) return null;
          return { lessonId: lesson.id, lessonTitle: lesson.title, lessonNumber: lesson.lesson_number };
        })
        .filter((row): row is { lessonId: string; lessonTitle: string; lessonNumber: number } => Boolean(row))
        .sort((a, b) => b.lessonNumber - a.lessonNumber)[0];

      if (!candidate) continue;

      const { data: submission } = await supabase
        .from("homework_submissions")
        .select("id")
        .eq("student_id", target.studentId)
        .eq("lesson_id", candidate.lessonId)
        .maybeSingle();
      if (submission?.id) continue;

      const { data: existingLog } = await supabase
        .from("homework_due_reminder_logs")
        .select("id")
        .eq("student_id", target.studentId)
        .eq("session_id", target.sessionId)
        .eq("lesson_id", candidate.lessonId)
        .maybeSingle();
      if (existingLog?.id) continue;

      await supabase.rpc("_create_notification", {
        p_user_id: target.studentId,
        p_type: "announcement",
        p_actor_user_id: null,
        p_payload: {
          title: "Homework reminder",
          body: "You have an upcoming lesson within 24 hours and homework is still pending. Please submit it before your lesson.",
          homework_due: true,
          lesson_id: candidate.lessonId,
          lesson_title: candidate.lessonTitle,
          next_lesson_starts_at: target.startsAt,
        },
      });

      await supabase.from("homework_due_reminder_logs").insert({
        student_id: target.studentId,
        session_id: target.sessionId,
        lesson_id: candidate.lessonId,
      });

      sent += 1;
    } catch {
      errors += 1;
    }
  }

  return { sent, scanned: targets.length, errors };
}
