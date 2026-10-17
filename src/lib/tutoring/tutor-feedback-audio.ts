import { extensionForHomeworkMime, isUuid } from "@/lib/tutoring/homework-recording-upload";

export const TUTOR_FEEDBACK_MAX_SECONDS = 120;
export const TUTOR_FEEDBACK_MAX_BYTES = 8 * 1024 * 1024;

const FEEDBACK_PATH_RE =
  /^feedback\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(\d{10,16})\.(webm|m4a|ogg|mp3|wav)$/i;

export type TutorFeedbackAudioMeta = {
  path: string;
  mimeType: string;
  durationSeconds: number;
};

export function buildTutorFeedbackAudioPath(
  submissionId: string,
  mimeType: string,
  now = Date.now()
): string | null {
  if (!isUuid(submissionId)) return null;
  const extension = extensionForHomeworkMime(mimeType);
  if (!extension) return null;
  if (!Number.isFinite(now) || now < 0) return null;
  return `feedback/${submissionId.toLowerCase()}/${Math.trunc(now)}.${extension}`;
}

export function parseTutorFeedbackAudio(
  submissionId: string,
  input: TutorFeedbackAudioMeta
): TutorFeedbackAudioMeta | null {
  if (!isUuid(submissionId)) return null;
  const match = FEEDBACK_PATH_RE.exec(input.path.trim());
  if (!match) return null;
  if (match[1]?.toLowerCase() !== submissionId.toLowerCase()) return null;
  const extension = extensionForHomeworkMime(input.mimeType);
  if (!extension || match[3]?.toLowerCase() !== extension) return null;
  if (!Number.isFinite(input.durationSeconds)) return null;
  const durationSeconds = Math.round(input.durationSeconds);
  if (durationSeconds < 0 || durationSeconds > TUTOR_FEEDBACK_MAX_SECONDS) return null;
  const mimeType = input.mimeType.trim().slice(0, 120);
  if (!mimeType) return null;
  return { path: input.path.trim(), mimeType, durationSeconds };
}
