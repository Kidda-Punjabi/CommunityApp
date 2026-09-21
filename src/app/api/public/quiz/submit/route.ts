import { validateGuestIdentity } from "@/lib/public-forms/guest";
import { lookupPublicFormLinkBySlug } from "@/lib/public-forms/links";
import { savePublicQuizAttempt } from "@/lib/public-forms/save-public-quiz-attempt";
import { loadPublicFormSelectOptions } from "@/lib/public-forms/load-cohort-options";
import { loadPublicQuizById } from "@/lib/public-forms/load-quiz";
import { isPublicFeedbackTutor, publicCohortAudienceFromCourse } from "@/lib/public-forms/options";
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

  const link = await lookupPublicFormLinkBySlug(slug);
  if (!link || link.formType !== "quiz") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const quiz = await loadPublicQuizById(link.targetId);
  if (!quiz) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const audience = publicCohortAudienceFromCourse({
    courseName: quiz.courseName,
    contentTrack: quiz.contentTrack,
  });
  const identity = validateGuestIdentity(
    {
      fullName: raw.fullName,
      email: raw.email,
      phone: raw.phone,
    },
    { requireContact: audience !== "kids" }
  );
  if (!identity.ok) {
    return NextResponse.json({ error: identity.error }, { status: 400 });
  }

  const scoreRaw = Number(raw.score);
  if (!Number.isFinite(scoreRaw) || scoreRaw < 0 || scoreRaw > 100) {
    return NextResponse.json({ error: "Score must be between 0 and 100." }, { status: 400 });
  }
  const score = Math.round(scoreRaw);

  const cohort = typeof raw.cohort === "string" ? raw.cohort.trim() : "";
  const tutor = typeof raw.tutor === "string" ? raw.tutor.trim() : "";
  const { cohorts, tutors } = await loadPublicFormSelectOptions(audience);
  if (!cohort || !cohorts.includes(cohort)) {
    return NextResponse.json({ error: "Please choose a valid cohort." }, { status: 400 });
  }
  if (!isPublicFeedbackTutor(tutor, tutors)) {
    return NextResponse.json({ error: "Please choose your tutor." }, { status: 400 });
  }

  const configError = getServiceRoleConfigError();
  if (configError) {
    return NextResponse.json({ error: "Unable to save your score." }, { status: 500 });
  }

  const supabase = createServiceRoleClient();
  try {
    await savePublicQuizAttempt(supabase, {
      fullName: identity.identity.fullName,
      email: identity.identity.email,
      phone: identity.identity.phone,
      quizId: link.targetId,
      score,
      cohort,
      tutor,
    });
  } catch (error) {
    console.error(
      "[public quiz submit] insert failed",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: "Unable to save your score." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
