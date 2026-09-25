import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { canReadLessonLogMedia } from "@/lib/storage/lesson-log-media-access";
import {
  LESSON_LOG_MEDIA_BUCKET,
  PRIVATE_USER_UPLOAD_BUCKETS,
} from "@/lib/storage/signed-media";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ bucket: string; path: string[] }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { bucket, path: pathParts } = await context.params;
  if (!PRIVATE_USER_UPLOAD_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const objectPath = pathParts.map((part) => decodeURIComponent(part)).join("/");
  if (!objectPath || objectPath.includes("..")) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const admin = createServiceRoleClient();

  if (bucket === LESSON_LOG_MEDIA_BUCKET) {
    const allowed = await canReadLessonLogMedia(user, supabase, admin, objectPath);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
  }

  const { data, error } = await admin.storage.from(bucket).createSignedUrl(objectPath, 3600);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl, 302);
}
