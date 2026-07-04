import type { AudioContentType } from "@/lib/audio/types";

export const AUDIO_BUCKETS = {
  lesson: "lesson-audio",
  comprehension_sentence: "comprehension-audio",
} as const satisfies Record<AudioContentType, string>;

export function bucketForContentType(contentType: AudioContentType): string {
  return AUDIO_BUCKETS[contentType];
}

export function publicUrlForAudioPath(
  supabaseUrl: string,
  bucket: string,
  storagePath: string
): string {
  const base = supabaseUrl.replace(/\/$/, "");
  const encoded = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/storage/v1/object/public/${bucket}/${encoded}`;
}
