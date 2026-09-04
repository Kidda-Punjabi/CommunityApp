import { validateGuestIdentity } from "@/lib/public-forms/guest";
import { lookupPublicFormLinkBySlug } from "@/lib/public-forms/links";
import { createServiceRoleClient, getServiceRoleConfigError } from "@/lib/supabase/admin-server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const slug = typeof raw.slug === "string" ? raw.slug.trim() : "";
  const identity = validateGuestIdentity({
    fullName: raw.fullName,
    email: raw.email,
    phone: raw.phone,
  });
  if (!identity.ok) {
    return NextResponse.json({ error: identity.error }, { status: 400 });
  }

  const scoreRaw = Number(raw.score);
  if (!Number.isFinite(scoreRaw) || scoreRaw < 0 || scoreRaw > 100) {
    return NextResponse.json({ error: "Score must be between 0 and 100." }, { status: 400 });
  }
  const score = Math.round(scoreRaw);

  const link = await lookupPublicFormLinkBySlug(slug);
  if (!link || link.formType !== "quiz") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const configError = getServiceRoleConfigError();
  if (configError) {
    return NextResponse.json({ error: "Unable to save your score." }, { status: 500 });
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("public_quiz_attempts").insert({
    full_name: identity.identity.fullName,
    email: identity.identity.email,
    phone: identity.identity.phone,
    quiz_id: link.targetId,
    score,
  });

  if (error) {
    return NextResponse.json({ error: "Unable to save your score." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
