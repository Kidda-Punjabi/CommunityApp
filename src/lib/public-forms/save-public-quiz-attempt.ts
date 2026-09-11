import {
  buildNotionTestScoreProperties,
  createNotionTestScorePage,
  studentScoreFromPercent,
  weekSelectFromQuizTitle,
} from "@/lib/public-forms/quiz-notion";
import { resolveQuizStudentNotionFields } from "@/lib/public-forms/resolve-quiz-student";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PublicQuizAttemptInput = {
  fullName: string;
  email: string;
  phone: string;
  quizId: string;
  score: number;
};

export type PublicQuizAttemptRow = {
  id: string;
  full_name: string;
  email: string;
  quiz_id: string;
  score: number;
  submitted_at: string;
};

async function loadQuizScoreContext(
  supabase: SupabaseClient,
  quizId: string
): Promise<{ courseId: string; courseName: string; quizTitle: string; maxScore: number } | null> {
  const [{ data: quiz, error: quizError }, { count, error: countError }] = await Promise.all([
    supabase.from("quizzes").select("id, title, course_id, courses(name)").eq("id", quizId).maybeSingle(),
    supabase.from("quiz_questions").select("id", { count: "exact", head: true }).eq("quiz_id", quizId),
  ]);

  if (quizError || countError || !quiz) return null;

  const course = Array.isArray(quiz.courses) ? quiz.courses[0] : quiz.courses;
  const courseName = (course as { name?: string } | null)?.name?.trim();
  const maxScore = count ?? 0;
  const courseId = typeof quiz.course_id === "string" ? quiz.course_id : "";
  const quizTitle = typeof quiz.title === "string" ? quiz.title : "";
  if (!courseName || !courseId || maxScore <= 0) return null;

  return { courseId, courseName, quizTitle, maxScore };
}

export async function syncPublicQuizAttemptToNotion(
  supabase: SupabaseClient,
  row: PublicQuizAttemptRow
): Promise<{ notionSynced: boolean; notionError?: string }> {
  try {
    const context = await loadQuizScoreContext(supabase, row.quiz_id);
    if (!context) {
      throw new Error("Quiz course or question count is missing for Test Scores sync.");
    }

    const student = await resolveQuizStudentNotionFields(
      supabase,
      row.email,
      context.courseId
    );

    const properties = buildNotionTestScoreProperties({
      fullName: row.full_name,
      email: row.email,
      courseName: context.courseName,
      studentScore: studentScoreFromPercent(row.score, context.maxScore),
      maxScore: context.maxScore,
      submittedAt: new Date(row.submitted_at),
      cohort: student.cohort,
      week: weekSelectFromQuizTitle(context.quizTitle),
      tutor: student.tutor,
    });
    const { pageId } = await createNotionTestScorePage(properties);

    await supabase
      .from("public_quiz_attempts")
      .update({
        notion_page_id: pageId,
        notion_sync_status: "synced",
        notion_synced_at: new Date().toISOString(),
        notion_sync_error: null,
      })
      .eq("id", row.id);

    return { notionSynced: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notion sync failed.";
    console.error("[public quiz notion] sync failed", row.id, message);
    await supabase
      .from("public_quiz_attempts")
      .update({
        notion_sync_status: "failed",
        notion_sync_error: message,
      })
      .eq("id", row.id);

    return { notionSynced: false, notionError: message };
  }
}

export async function savePublicQuizAttempt(
  supabase: SupabaseClient,
  input: PublicQuizAttemptInput
): Promise<{
  attemptId: string;
  notionSynced: boolean;
  notionError?: string;
}> {
  const submittedAt = new Date();

  const { data: row, error: insertError } = await supabase
    .from("public_quiz_attempts")
    .insert({
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      quiz_id: input.quizId,
      score: input.score,
      notion_sync_status: "pending",
      submitted_at: submittedAt.toISOString(),
    })
    .select("id, full_name, email, quiz_id, score, submitted_at")
    .single();

  if (insertError || !row) {
    throw new Error(insertError?.message ?? "Failed to save quiz score.");
  }

  const synced = await syncPublicQuizAttemptToNotion(supabase, row);
  return {
    attemptId: row.id,
    notionSynced: synced.notionSynced,
    notionError: synced.notionError,
  };
}
