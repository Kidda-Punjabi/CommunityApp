import { parsePublicFeedbackTarget } from "@/lib/public-forms/feedback-target";
import { lookupPublicFormLinkBySlug } from "@/lib/public-forms/links";
import { uploadGuestFeedbackPhoto } from "@/lib/public-forms/upload-guest-photo";
import { getServiceRoleConfigError } from "@/lib/supabase/admin-server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const slug = String(form.get("slug") ?? "").trim();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Please choose a photo." }, { status: 400 });
  }

  const link = await lookupPublicFormLinkBySlug(slug);
  if (!link || link.formType !== "feedback") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const target = parsePublicFeedbackTarget(link.targetId);
  if (!target || target.formVariant !== "week12") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (getServiceRoleConfigError()) {
    return NextResponse.json({ error: "Unable to upload photo." }, { status: 500 });
  }

  try {
    const url = await uploadGuestFeedbackPhoto(file);
    return NextResponse.json({ ok: true, url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to upload photo." },
      { status: 400 }
    );
  }
}
