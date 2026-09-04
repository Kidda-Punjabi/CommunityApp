import { parseFeedbackSubmitBody } from "@/lib/feedback/validate-submit";
import type { FeedbackContext } from "@/lib/feedback/types";
import { saveFeedbackSubmission } from "@/lib/feedback/save-feedback";
import { parsePublicFeedbackTarget } from "@/lib/public-forms/feedback-target";
import { validateGuestIdentity } from "@/lib/public-forms/guest";
import { lookupPublicFormLinkBySlug } from "@/lib/public-forms/links";
import { loadPublicCohortOptions } from "@/lib/public-forms/load-cohort-options";
import { loadBeginnersLessonId } from "@/lib/public-forms/load-quiz";
import { isPublicFeedbackTutor } from "@/lib/public-forms/options";
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

  const cohort = typeof raw.cohort === "string" ? raw.cohort.trim() : "";
  const tutor = typeof raw.tutor === "string" ? raw.tutor.trim() : "";
  if (!cohort) {
    return NextResponse.json({ error: "Please choose your cohort." }, { status: 400 });
  }
  if (!isPublicFeedbackTutor(tutor)) {
    return NextResponse.json({ error: "Please choose your tutor." }, { status: 400 });
  }

  const link = await lookupPublicFormLinkBySlug(slug);
  if (!link || link.formType !== "feedback") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const target = parsePublicFeedbackTarget(link.targetId);
  if (!target) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const cohorts = await loadPublicCohortOptions();
  if (!cohorts.includes(cohort)) {
    return NextResponse.json({ error: "Please choose a valid cohort." }, { status: 400 });
  }

  const parsed = parseFeedbackSubmitBody({
    ...raw,
    formVariant: target.formVariant,
    lessonId: null,
    sessionId: null,
  });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  if (parsed.payload.formVariant !== target.formVariant) {
    return NextResponse.json({ error: "Invalid feedback form." }, { status: 400 });
  }

  const configError = getServiceRoleConfigError();
  if (configError) {
    return NextResponse.json({ error: "Unable to submit feedback." }, { status: 500 });
  }

  const lessonId = await loadBeginnersLessonId(target.lessonNumber);
  const context: FeedbackContext = {
    fullName: identity.identity.fullName,
    email: identity.identity.email,
    phone: identity.identity.phone,
    cohort,
    course: "Beginners Course",
    lessonLabel: target.lessonLabel,
    lessonNumber: target.lessonNumber,
    tutor,
    notionTutor: tutor,
    tutorUnmatched: false,
    lessonId,
    sessionId: null,
    formVariant: target.formVariant,
  };

  try {
    const supabase = createServiceRoleClient();
    const result = await saveFeedbackSubmission(
      supabase,
      null,
      context,
      { ...parsed.payload, lessonId, formVariant: target.formVariant },
      { isGuest: true }
    );

    return NextResponse.json({
      ok: true,
      submissionId: result.submissionId,
      notionSynced: result.notionSynced,
      notionError: result.notionError,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to submit feedback.",
      },
      { status: 500 }
    );
  }
}
