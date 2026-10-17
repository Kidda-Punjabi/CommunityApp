import { createClient } from "@/lib/supabase/client";
import { HOMEWORK_RECORDINGS_BUCKET } from "@/lib/tutoring/homework-submissions";
import {
  buildTutorFeedbackAudioPath,
  TUTOR_FEEDBACK_MAX_BYTES,
} from "@/lib/tutoring/tutor-feedback-audio";

export async function uploadTutorFeedbackAudio(input: {
  submissionId: string;
  blob: Blob;
  mimeType: string;
}): Promise<{ path: string } | { error: string }> {
  const path = buildTutorFeedbackAudioPath(input.submissionId, input.mimeType);
  if (!path) return { error: "This recording format is not supported." };
  if (input.blob.size <= 0 || input.blob.size > TUTOR_FEEDBACK_MAX_BYTES) {
    return { error: "Voice notes can be up to 2 minutes." };
  }

  const supabase = createClient();
  const { error } = await supabase.storage.from(HOMEWORK_RECORDINGS_BUCKET).upload(path, input.blob, {
    contentType: input.mimeType,
    upsert: false,
  });
  if (error) return { error: "The voice note could not be saved." };
  return { path };
}

export async function removeTutorFeedbackAudio(path: string): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(HOMEWORK_RECORDINGS_BUCKET).remove([path]);
}
