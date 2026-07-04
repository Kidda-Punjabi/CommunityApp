import type { SupabaseClient } from "@supabase/supabase-js";
import type { StorageBucket } from "@/lib/supabase/upload";

const REQUIRED_BUCKETS: StorageBucket[] = [
  "audio-files",
  "profile-photos",
  "lesson-pdfs",
  "site-branding",
  "comprehension-audio",
  "lesson-audio",
];

export async function ensureStorageBuckets(supabase: SupabaseClient) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error("Failed to list storage buckets:", listError.message);
    return;
  }

  const existing = new Set((buckets ?? []).map((bucket) => bucket.id));

  for (const id of REQUIRED_BUCKETS) {
    if (existing.has(id)) continue;

    const { error } = await supabase.storage.createBucket(id, { public: true });
    if (error && !error.message.toLowerCase().includes("already exists")) {
      console.error(`Failed to create storage bucket "${id}":`, error.message);
    }
  }
}
