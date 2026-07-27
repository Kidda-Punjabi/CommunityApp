import type { SupabaseClient } from "@supabase/supabase-js";
import type { StorageBucket } from "@/lib/supabase/upload";

/**
 * Per-bucket options.
 * Note: this Supabase project's Storage API rejects fileSizeLimit above ~50MB
 * ("The object exceeded the maximum allowed size"). Omit the limit so large
 * video recordings can upload like lesson-recordings (null = project default).
 * Client UI still warns above 500MB as a soft guard.
 */
const REQUIRED_BUCKETS: Array<{
  id: StorageBucket;
  public: boolean;
}> = [
  { id: "audio-files", public: true },
  { id: "profile-photos", public: true },
  { id: "lesson-pdfs", public: true },
  { id: "site-branding", public: true },
  { id: "comprehension-audio", public: true },
  { id: "lesson-audio", public: true },
  // Public URLs for cohort_lesson_log_entries.recording_url / slides_url / flashcards_url.
  { id: "lesson-log-media", public: true },
];

export async function ensureStorageBuckets(supabase: SupabaseClient) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error("Failed to list storage buckets:", listError.message);
    return;
  }

  const existing = new Set((buckets ?? []).map((bucket) => bucket.id));

  for (const spec of REQUIRED_BUCKETS) {
    if (existing.has(spec.id)) continue;

    const { error } = await supabase.storage.createBucket(spec.id, {
      public: spec.public,
    });
    if (error && !error.message.toLowerCase().includes("already exists")) {
      console.error(`Failed to create storage bucket "${spec.id}":`, error.message);
    }
  }
}
