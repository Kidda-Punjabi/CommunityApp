import { NextResponse } from "next/server";
import { canAccessPhotoTranslate } from "@/lib/photo-translate/access";
import { PHOTO_TRANSLATE_MONTHLY_CAP_SCANS } from "@/lib/photo-translate/config";
import { currentMonthKeyUtc } from "@/lib/photo-translate/month-key";
import { scanPhotoForPunjabiText } from "@/lib/photo-translate/scan-image";
import {
  capReachedMessage,
  incrementPhotoTranslateUsage,
  loadPhotoTranslateUsage,
} from "@/lib/photo-translate/usage";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const access = await getCourseAccessContext(supabase, user);
  if (!canAccessPhotoTranslate(access)) {
    return NextResponse.json(
      { error: "Photo Translate is available on paid Kidda plans." },
      { status: 403 }
    );
  }

  const { client: adminClient, error: adminError } = tryCreateServiceRoleClient();
  if (!adminClient) {
    return NextResponse.json({ error: adminError }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const image = formData.get("image");
  if (!(image instanceof Blob) || image.size === 0) {
    return NextResponse.json({ error: "Missing photo." }, { status: 400 });
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Photo is too large — try a closer shot." }, { status: 400 });
  }

  const monthKey = currentMonthKeyUtc();

  let usage;
  try {
    usage = await loadPhotoTranslateUsage(adminClient, user.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load usage.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (usage.scansUsed >= PHOTO_TRANSLATE_MONTHLY_CAP_SCANS) {
    return NextResponse.json(
      {
        error: "cap_reached",
        message: capReachedMessage(usage.resetsOn),
        scans_remaining_this_month: 0,
        scans_used_this_month: usage.scansUsed,
        month_key: monthKey,
        resets_on: usage.resetsOn,
      },
      { status: 429 }
    );
  }

  try {
    const imageBytes = await image.arrayBuffer();
    const mediaType = image.type || "image/jpeg";
    const result = await scanPhotoForPunjabiText(imageBytes, mediaType);
    const updatedUsage = await incrementPhotoTranslateUsage(adminClient, user.id);

    return NextResponse.json({
      text_detected: result.text_detected,
      full_translation: result.full_translation,
      summary: result.summary,
      scans_remaining_this_month: updatedUsage.scansRemaining,
      scans_used_this_month: updatedUsage.scansUsed,
      month_key: updatedUsage.monthKey,
      resets_on: updatedUsage.resetsOn,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Photo scan failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const access = await getCourseAccessContext(supabase, user);
  if (!canAccessPhotoTranslate(access)) {
    return NextResponse.json(
      { error: "Photo Translate is available on paid Kidda plans." },
      { status: 403 }
    );
  }

  const { client: adminClient, error: adminError } = tryCreateServiceRoleClient();
  if (!adminClient) {
    return NextResponse.json({ error: adminError }, { status: 500 });
  }

  try {
    const usage = await loadPhotoTranslateUsage(adminClient, user.id);
    return NextResponse.json({
      scans_remaining_this_month: usage.scansRemaining,
      scans_used_this_month: usage.scansUsed,
      month_key: usage.monthKey,
      resets_on: usage.resetsOn,
      cap_scans: usage.capScans,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load usage.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
