import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveCourseActor,
  studentActorFilter,
  type CourseActor,
} from "@/lib/kids/course-actor";
import { getDisplayName } from "@/lib/profile/display-name";
import { formatKidsNextLessonWarning } from "@/lib/tutoring/homework-timing";

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
  state: "on_time" | "late" | "post_lesson" | "unknown" | null | undefined,
  options?: { nextLessonStartsAt?: string | null; usesKidsNextLesson?: boolean }
): string | null {
  if (state === "late") {
    if (options?.usesKidsNextLesson && options.nextLessonStartsAt) {
      return formatKidsNextLessonWarning(options.nextLessonStartsAt);
    }
    return HOMEWORK_NEAR_LESSON_WARNING;
  }
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

export function homeworkReviewDisplayName(input: {
  kidName?: string | null;
  student?: { full_name?: string | null; preferred_name?: string | null } | null;
}): string {
  const kidName = input.kidName?.trim();
  if (kidName) return kidName;
  return getDisplayName(input.student) ?? "Student";
}

const HOMEWORK_VIEW_SELECT =
  "id, lesson_id, storage_path, mime_type, duration_seconds, submission_type, text_answers, status, approved, tutor_comment, submitted_at";

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
    .select(HOMEWORK_VIEW_SELECT)
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

export async function fetchFormalHomeworkForActor(
  supabase: SupabaseClient,
  actor: CourseActor,
  lessonId: string
): Promise<HomeworkSubmissionView | null> {
  const filter = studentActorFilter(actor);
  const { data, error } = await supabase
    .from("homework_submissions")
    .select(HOMEWORK_VIEW_SELECT)
    .eq("lesson_id", lessonId)
    .eq(filter.column, filter.value)
    .eq("is_practice", false)
    .maybeSingle();

  if (error) {
    if (isMissingHomeworkSchema(error.message)) return null;
    throw error;
  }

  return data ? toView(data as HomeworkRow) : null;
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

export type HomeworkCohortRosterStudent = {
  studentId: string;
  studentName: string;
  isActiveMember: boolean;
  pendingSubmission: PendingHomeworkReviewRow | null;
  reviewedStatus: "approved" | "needs_improvement" | null;
};

/** Matches attendance: kid_profile_id takes precedence over student_id. */
export function homeworkRosterActorKey(row: {
  student_id?: string | null;
  kid_profile_id?: string | null;
}): string | null {
  return row.kid_profile_id ?? row.student_id ?? null;
}

type HomeworkReviewQueryRow = {
  id: string;
  student_id: string | null;
  kid_profile_id: string | null;
  lesson_id: string;
  storage_path: string | null;
  mime_type: string | null;
  duration_seconds: number | null;
  submission_type?: HomeworkSubmissionType | null;
  text_answers?: Array<{ question_number: number; answer_text: string }> | null;
  submitted_at: string;
  status?: HomeworkSubmissionStatus | null;
  approved?: boolean | null;
  student?:
    | { full_name?: string | null; preferred_name?: string | null }
    | { full_name?: string | null; preferred_name?: string | null }[]
    | null;
  kid_profile?: { name?: string | null } | { name?: string | null }[] | null;
  lesson?:
    | { title?: string | null; lesson_number?: number | null }
    | { title?: string | null; lesson_number?: number | null }[]
    | null;
};

const HOMEWORK_REVIEW_SELECT = `
      id,
      student_id,
      kid_profile_id,
      lesson_id,
      storage_path,
      mime_type,
      duration_seconds,
      submission_type,
      text_answers,
      submitted_at,
      status,
      approved,
      student:student_id (full_name, preferred_name),
      kid_profile:kid_profile_id (name),
      lesson:lesson_id (title, lesson_number)
    `;

async function toPendingHomeworkReviewRow(
  supabase: SupabaseClient,
  row: HomeworkReviewQueryRow
): Promise<PendingHomeworkReviewRow> {
  const student = Array.isArray(row.student) ? row.student[0] : row.student;
  const kidProfile = Array.isArray(row.kid_profile) ? row.kid_profile[0] : row.kid_profile;
  const lesson = Array.isArray(row.lesson) ? row.lesson[0] : row.lesson;
  const lessonId = row.lesson_id;
  const kidProfileId = row.kid_profile_id ?? null;
  const studentId =
    homeworkRosterActorKey(row) ?? row.student_id ?? kidProfileId ?? "";
  const submittedAt = row.submitted_at;
  const submissionType: HomeworkSubmissionType =
    row.submission_type === "text" ? "text" : "voice";

  const { loadHomeworkTextQuestionsForLesson } = await import(
    "@/lib/catchup/load-segment-questions"
  );
  const {
    findHomeworkLessonSessionStartsAt,
    homeworkTimingStateFromStartsAt,
  } = await import("@/lib/tutoring/homework-near-lesson");

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
    lessonId,
    kidProfileId
  );
  const timingState = homeworkTimingStateFromStartsAt(
    lessonStartsAt,
    new Date(submittedAt)
  );

  return {
    id: row.id,
    studentId,
    studentName: homeworkReviewDisplayName({
      kidName: kidProfile?.name,
      student: student ?? null,
    }),
    lessonId,
    lessonTitle: lesson?.title ?? "Lesson",
    lessonNumber: lesson?.lesson_number ?? 0,
    submittedAt,
    submissionType,
    storagePath: row.storage_path ?? null,
    mimeType: row.mime_type ?? null,
    durationSeconds: row.duration_seconds ?? null,
    textAnswers: row.text_answers ?? null,
    answerKeys,
    timingState,
  };
}

export async function loadPendingHomeworkReviews(
  supabase: SupabaseClient
): Promise<PendingHomeworkReviewRow[]> {
  const { data, error } = await supabase
    .from("homework_submissions")
    .select(HOMEWORK_REVIEW_SELECT)
    .eq("status", "pending_review")
    .eq("is_practice", false)
    .order("submitted_at", { ascending: true });

  if (error) {
    if (isMissingHomeworkSchema(error.message)) return [];
    throw error;
  }

  return Promise.all(
    ((data ?? []) as HomeworkReviewQueryRow[]).map((row) =>
      toPendingHomeworkReviewRow(supabase, row)
    )
  );
}

export async function loadHomeworkCohortRoster(
  supabase: SupabaseClient,
  cohortId: string,
  lessonId: string
): Promise<HomeworkCohortRosterStudent[]> {
  const { loadCohortMembershipRoster } = await import("@/lib/tutoring/cohort-attendance");
  const students = await loadCohortMembershipRoster(supabase, cohortId);
  if (students.length === 0) return [];

  const actorIds = students.map((student) => student.studentId);
  const { data, error } = await supabase
    .from("homework_submissions")
    .select(HOMEWORK_REVIEW_SELECT)
    .eq("lesson_id", lessonId)
    .eq("is_practice", false)
    .or(`student_id.in.(${actorIds.join(",")}),kid_profile_id.in.(${actorIds.join(",")})`);

  if (error) {
    if (isMissingHomeworkSchema(error.message)) {
      return students.map((student) => ({
        ...student,
        pendingSubmission: null,
        reviewedStatus: null,
      }));
    }
    throw error;
  }

  const byActor = new Map<string, HomeworkReviewQueryRow>();
  for (const row of (data ?? []) as HomeworkReviewQueryRow[]) {
    const key = homeworkRosterActorKey(row);
    if (key) byActor.set(key, row);
  }

  return Promise.all(
    students.map(async (student) => {
      const row = byActor.get(student.studentId);
      if (!row) {
        return { ...student, pendingSubmission: null, reviewedStatus: null };
      }

      if (row.status === "reviewed") {
        return {
          ...student,
          pendingSubmission: null,
          reviewedStatus: row.approved === true ? "approved" : "needs_improvement",
        };
      }

      return {
        ...student,
        pendingSubmission: await toPendingHomeworkReviewRow(supabase, row),
        reviewedStatus: null,
      };
    })
  );
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
