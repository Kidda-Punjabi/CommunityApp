import type { CourseActor } from "@/lib/kids/course-actor";

/** Shown when the signed URL or the direct storage upload fails. */
export const HOMEWORK_RECORDING_UPLOAD_ERROR =
  "Recording failed to upload, please try again";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OWNED_RECORDING_PATH_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(self|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(\d+)\.(webm|m4a|ogg|mp3|wav)$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Map a recorder MIME type to a storage extension. Returns null for anything else. */
export function extensionForHomeworkMime(mimeType: string): string | null {
  const mime = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (mime === "audio/webm") return "webm";
  if (mime === "audio/mp4" || mime === "audio/m4a" || mime === "audio/x-m4a") return "m4a";
  if (mime === "audio/ogg") return "ogg";
  if (mime === "audio/mpeg" || mime === "audio/mp3") return "mp3";
  if (mime === "audio/wav" || mime === "audio/wave" || mime === "audio/x-wav") return "wav";
  return null;
}

/**
 * Folder the signed upload is allowed to write.
 * First segment is always the authenticated account. Kid sessions add the
 * server-resolved profile id; adult students use "self".
 */
export function homeworkRecordingFolder(actor: CourseActor): string | null {
  if (!isUuid(actor.userId)) return null;
  const owner = actor.userId.toLowerCase();
  if (actor.kind === "kid") {
    if (!actor.kidProfileId || !isUuid(actor.kidProfileId)) return null;
    return `${owner}/${actor.kidProfileId.toLowerCase()}`;
  }
  return `${owner}/self`;
}

export function buildHomeworkRecordingStoragePath(
  actor: CourseActor,
  mimeType: string,
  now = Date.now()
): string | null {
  const folder = homeworkRecordingFolder(actor);
  const extension = extensionForHomeworkMime(mimeType);
  if (!folder || !extension) return null;
  if (!Number.isFinite(now) || now < 0) return null;
  return `${folder}/${Math.trunc(now)}.${extension}`;
}

/** True only when the path is exactly this actor's folder plus a generated file name. */
export function isOwnHomeworkRecordingPath(actor: CourseActor, storagePath: string): boolean {
  const folder = homeworkRecordingFolder(actor);
  if (!folder) return false;
  const match = OWNED_RECORDING_PATH_RE.exec(storagePath);
  if (!match) return false;
  const owner = match[1]?.toLowerCase();
  const scope = match[2]?.toLowerCase();
  const expectedScope = actor.kind === "kid" ? actor.kidProfileId!.toLowerCase() : "self";
  return owner === actor.userId.toLowerCase() && scope === expectedScope;
}

export function mimeMatchesHomeworkRecordingPath(mimeType: string, storagePath: string): boolean {
  const extension = extensionForHomeworkMime(mimeType);
  if (!extension) return false;
  return storagePath.toLowerCase().endsWith(`.${extension}`);
}
