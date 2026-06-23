import type { SupabaseClient } from "@supabase/supabase-js";

export type HomeworkSubmissionStatus = "pending_review" | "reviewed";

export type HomeworkSubmissionView = {
  id: string;
  lessonId: string;
  storagePath: string;
  mimeType: string | null;
  durationSeconds: number | null;
  status: HomeworkSubmissionStatus;
  approved: boolean | null;
  tutorComment: string | null;
  submittedAt: string;
};

type HomeworkRow = {
  id: string;
  lesson_id: string;
  storage_path: string;
  mime_type: string | null;
  duration_seconds: number | null;
  status: HomeworkSubmissionStatus;
  approved: boolean | null;
  tutor_comment: string | null;
  submitted_at: string;
};

function toView(row: HomeworkRow): HomeworkSubmissionView {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    durationSeconds: row.duration_seconds,
    status: row.status,
    approved: row.approved,
    tutorComment: row.tutor_comment,
    submittedAt: row.submitted_at,
  };
}

function isMissingHomeworkSchema(message: string): boolean {
  return message.toLowerCase().includes("homework_submissions");
}

export async function fetchHomeworkSubmissionsForUser(
  supabase: SupabaseClient,
  userId: string,
  lessonIds: string[]
): Promise<Map<string, HomeworkSubmissionView>> {
  const map = new Map<string, HomeworkSubmissionView>();
  if (lessonIds.length === 0) return map;

  const { data, error } = await supabase
    .from("homework_submissions")
    .select(
      "id, lesson_id, storage_path, mime_type, duration_seconds, status, approved, tutor_comment, submitted_at"
    )
    .eq("student_id", userId)
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
  storagePath: string;
  mimeType: string | null;
  durationSeconds: number | null;
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
      submitted_at,
      student:student_id (full_name, preferred_name),
      lesson:lesson_id (title, lesson_number)
    `
    )
    .eq("status", "pending_review")
    .order("submitted_at", { ascending: true });

  if (error) {
    if (isMissingHomeworkSchema(error.message)) return [];
    throw error;
  }

  const { getDisplayName } = await import("@/lib/profile/display-name");

  return (data ?? []).map((row) => {
    const student = Array.isArray(row.student) ? row.student[0] : row.student;
    const lesson = Array.isArray(row.lesson) ? row.lesson[0] : row.lesson;

    return {
      id: row.id as string,
      studentId: row.student_id as string,
      studentName: getDisplayName(student) ?? "Student",
      lessonId: row.lesson_id as string,
      lessonTitle: (lesson?.title as string) ?? "Lesson",
      lessonNumber: (lesson?.lesson_number as number) ?? 0,
      submittedAt: row.submitted_at as string,
      storagePath: row.storage_path as string,
      mimeType: (row.mime_type as string | null) ?? null,
      durationSeconds: (row.duration_seconds as number | null) ?? null,
    };
  });
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
