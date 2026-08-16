import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveCourseActor, studentActorFilter } from "@/lib/kids/course-actor";

export type HomeworkSubmissionStatus = "pending_review" | "reviewed";
export type HomeworkSubmissionType = "voice" | "text";

export type HomeworkSubmissionView = {
  id: string;
  lessonId: string;
  submissionType: HomeworkSubmissionType;
  storagePath: string | null;
  mimeType: string | null;
  durationSeconds: number | null;
  textAnswers: Array<{ question_number: number; answer_text: string }> | null;
  status: HomeworkSubmissionStatus;
  approved: boolean | null;
  tutorComment: string | null;
  submittedAt: string;
};

type HomeworkRow = {
  id: string;
  lesson_id: string;
  storage_path: string | null;
  mime_type: string | null;
  duration_seconds: number | null;
  submission_type?: HomeworkSubmissionType | null;
  text_answers?: Array<{ question_number: number; answer_text: string }> | null;
  status: HomeworkSubmissionStatus;
  approved: boolean | null;
  tutor_comment: string | null;
  submitted_at: string;
};

function toView(row: HomeworkRow): HomeworkSubmissionView {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    submissionType: row.submission_type === "text" ? "text" : "voice",
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    durationSeconds: row.duration_seconds,
    textAnswers: row.text_answers ?? null,
    status: row.status,
    approved: row.approved,
    tutorComment: row.tutor_comment,
    submittedAt: row.submitted_at,
  };
}

function isMissingHomeworkSchema(message: string): boolean {
  return message.toLowerCase().includes("homework_submissions");
}

/** Shown when a formal (non-practice) row already exists for this lesson. */
export const HOMEWORK_ALREADY_SUBMITTED_MESSAGE =
  "You've already submitted homework for this lesson.";

export const HOMEWORK_NEAR_LESSON_WARNING =
  "Heads up — it's less than 24 hours until your lesson. Your tutor may not be able to mark this in time, but please still submit — it shows you're putting in the effort.";

export const HOMEWORK_POST_LESSON_WARNING =
  "This lesson has already taken place. You can still submit your homework, but whether it gets marked is completely up to your tutor — there's a good chance it won't be reviewed.";

export function homeworkTimingWarningMessage(
  state: "on_time" | "late" | "post_lesson" | "unknown" | null | undefined
): string | null {
  if (state === "late") return HOMEWORK_NEAR_LESSON_WARNING;
  if (state === "post_lesson") return HOMEWORK_POST_LESSON_WARNING;
  return null;
}

export function isDuplicateFormalHomeworkError(error: {
  code?: string;
  message?: string;
}): boolean {
  if (error.code === "23505") return true;
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("homework_submissions_one_formal_per_lesson") ||
    (message.includes("duplicate key") && message.includes("homework_submissions")) ||
    (message.includes("unique") &&
      message.includes("lesson_id") &&
      message.includes("student_id"))
  );
}

export function homeworkSubmitErrorMessage(error: {
  code?: string;
  message?: string;
}): string {
  if (isDuplicateFormalHomeworkError(error)) {
    return HOMEWORK_ALREADY_SUBMITTED_MESSAGE;
  }
  return error.message?.trim() || "Failed to submit homework.";
}

export async function fetchHomeworkSubmissionsForUser(
  supabase: SupabaseClient,
  userId: string,
  lessonIds: string[]
): Promise<Map<string, HomeworkSubmissionView>> {
  const map = new Map<string, HomeworkSubmissionView>();
  if (lessonIds.length === 0) return map;

  const actor = await resolveCourseActor(supabase, userId);
  const filter = studentActorFilter(actor);
  const { data, error } = await supabase
    .from("homework_submissions")
    .select(
      "id, lesson_id, storage_path, mime_type, duration_seconds, submission_type, text_answers, status, approved, tutor_comment, submitted_at"
    )
    .eq(filter.column, filter.value)
    .eq("is_practice", false)
    .in("lesson_id", lessonIds);

  if (error) {
    if (isMissingHomeworkSchema(error.message)) return map;
    throw error;
  }

  for (const row of (data ?? []) as HomeworkRow[]) {
    map.set(row.lesson_id, toView(row));
  }

  return map;
}

export type PendingHomeworkReviewRow = {
  id: string;
  studentId: string;
  studentName: string;
  lessonId: string;
  lessonTitle: string;
  lessonNumber: number;
  submittedAt: string;
  submissionType: HomeworkSubmissionType;
  storagePath: string | null;
  mimeType: string | null;
  durationSeconds: number | null;
  textAnswers: Array<{ question_number: number; answer_text: string }> | null;
  answerKeys: Array<{
    questionNumber: number;
    promptEnglish: string;
    answerRomanised: string;
    answerGurmukhi: string | null;
  }>;
  /** Relative to the matched live lesson start at submit time. */
  timingState: "on_time" | "late" | "post_lesson" | "unknown";
};

export async function loadPendingHomeworkReviews(
  supabase: SupabaseClient
): Promise<PendingHomeworkReviewRow[]> {
  const { data, error } = await supabase
    .from("homework_submissions")
    .select(
      `
      id,
      student_id,
      lesson_id,
      storage_path,
      mime_type,
      duration_seconds,
      submission_type,
      text_answers,
      submitted_at,
      student:student_id (full_name, preferred_name),
      lesson:lesson_id (title, lesson_number)
    `
    )
    .eq("status", "pending_review")
    .eq("is_practice", false)
    .order("submitted_at", { ascending: true });

  if (error) {
    if (isMissingHomeworkSchema(error.message)) return [];
    throw error;
  }

  const { getDisplayName } = await import("@/lib/profile/display-name");
  const { loadHomeworkTextQuestionsForLesson } = await import(
    "@/lib/catchup/load-segment-questions"
  );
  const {
    findHomeworkLessonSessionStartsAt,
    homeworkTimingStateFromStartsAt,
  } = await import("@/lib/tutoring/homework-near-lesson");

  const rows = await Promise.all(
    (data ?? []).map(async (row) => {
      const student = Array.isArray(row.student) ? row.student[0] : row.student;
      const lesson = Array.isArray(row.lesson) ? row.lesson[0] : row.lesson;
      const lessonId = row.lesson_id as string;
      const studentId = row.student_id as string;
      const submittedAt = row.submitted_at as string;
      const submissionType: HomeworkSubmissionType =
        row.submission_type === "text" ? "text" : "voice";

      const answerKeys =
        submissionType === "text"
          ? (await loadHomeworkTextQuestionsForLesson(supabase, lessonId)).map((question) => ({
              questionNumber: question.questionNumber,
              promptEnglish: question.promptEnglish,
              answerRomanised: question.answerRomanised,
              answerGurmukhi: question.answerGurmukhi,
            }))
          : [];

      const lessonStartsAt = await findHomeworkLessonSessionStartsAt(
        supabase,
        studentId,
        lessonId
      );
      const timingState = homeworkTimingStateFromStartsAt(
        lessonStartsAt,
        new Date(submittedAt)
      );

      return {
        id: row.id as string,
        studentId,
        studentName: getDisplayName(student) ?? "Student",
        lessonId,
        lessonTitle: (lesson?.title as string) ?? "Lesson",
        lessonNumber: (lesson?.lesson_number as number) ?? 0,
        submittedAt,
        submissionType,
        storagePath: (row.storage_path as string | null) ?? null,
        mimeType: (row.mime_type as string | null) ?? null,
        durationSeconds: (row.duration_seconds as number | null) ?? null,
        textAnswers:
          (row.text_answers as Array<{ question_number: number; answer_text: string }> | null) ??
          null,
        answerKeys,
        timingState,
      };
    })
  );

  return rows;
}

export const HOMEWORK_RECORDINGS_BUCKET = "homework-recordings";

export function homeworkStoragePath(
  lessonId: string,
  studentId: string,
  extension: string
): string {
  const ext = extension.replace(/^\./, "");
  return `${lessonId}/${studentId}/${Date.now()}.${ext}`;
}

export async function createHomeworkPlaybackUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(HOMEWORK_RECORDINGS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
