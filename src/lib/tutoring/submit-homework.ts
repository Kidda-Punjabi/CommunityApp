import "server-only";

import type { TextHomeworkAnswer } from "@/lib/catchup/load-segment-questions";
import {
  homeworkWrite,
  studentActorFilter,
  type CourseActor,
} from "@/lib/kids/course-actor";
import {
  HOMEWORK_ALREADY_SUBMITTED_MESSAGE,
  HOMEWORK_RECORDINGS_BUCKET,
  homeworkStoragePath,
  homeworkSubmitErrorMessage,
} from "@/lib/tutoring/homework-submissions";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PersistHomeworkResult =
  | { ok: true; storagePath: string | null }
  | { error: string };

function parseDurationSeconds(value: number | null): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

export async function persistVoiceHomework(input: {
  supabase: SupabaseClient;
  actor: CourseActor;
  lessonId: string;
  file: File;
  durationSeconds: number | null;
}): Promise<PersistHomeworkResult> {
  const { supabase, actor, lessonId, file } = input;
  const studentFilter = studentActorFilter(actor);
  const { data: existing } = await supabase
    .from("homework_submissions")
    .select("id, status")
    .eq("lesson_id", lessonId)
    .eq(studentFilter.column, studentFilter.value)
    .eq("is_practice", false)
    .maybeSingle();

  if (existing) {
    return { error: HOMEWORK_ALREADY_SUBMITTED_MESSAGE };
  }

  const extension = file.name.split(".").pop() || "webm";
  const storagePath = homeworkStoragePath(
    lessonId,
    actor.kind === "kid" ? actor.kidProfileId : actor.userId,
    extension
  );

  const { error: uploadError } = await supabase.storage
    .from(HOMEWORK_RECORDINGS_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || "audio/webm",
      upsert: false,
    });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { error: insertError } = await supabase.from("homework_submissions").insert(
    homeworkWrite(actor, {
      lesson_id: lessonId,
      submission_type: "voice",
      storage_path: storagePath,
      mime_type: file.type || null,
      duration_seconds: parseDurationSeconds(input.durationSeconds),
      status: "pending_review",
      submitted_at: new Date().toISOString(),
    })
  );

  if (insertError) {
    await supabase.storage.from(HOMEWORK_RECORDINGS_BUCKET).remove([storagePath]);
    return { error: homeworkSubmitErrorMessage(insertError) };
  }

  return { ok: true, storagePath };
}

export async function persistTextHomework(input: {
  supabase: SupabaseClient;
  actor: CourseActor;
  lessonId: string;
  answers: TextHomeworkAnswer[];
}): Promise<PersistHomeworkResult> {
  const { supabase, actor, lessonId, answers } = input;

  if (!answers.length || answers.some((row) => !row.answer_text?.trim())) {
    return { error: "Please answer every question before submitting." };
  }

  const studentFilter = studentActorFilter(actor);
  const { data: existing } = await supabase
    .from("homework_submissions")
    .select("id")
    .eq("lesson_id", lessonId)
    .eq(studentFilter.column, studentFilter.value)
    .eq("is_practice", false)
    .maybeSingle();

  if (existing) {
    return { error: HOMEWORK_ALREADY_SUBMITTED_MESSAGE };
  }

  const { error: insertError } = await supabase.from("homework_submissions").insert(
    homeworkWrite(actor, {
      lesson_id: lessonId,
      submission_type: "text",
      text_answers: answers.map((row) => ({
        question_number: row.question_number,
        answer_text: row.answer_text.trim(),
      })),
      status: "pending_review",
      submitted_at: new Date().toISOString(),
    })
  );

  if (insertError) return { error: homeworkSubmitErrorMessage(insertError) };

  return { ok: true, storagePath: null };
}
