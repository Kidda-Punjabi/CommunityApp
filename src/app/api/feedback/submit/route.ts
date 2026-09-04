import { loadCommunityClassFeedbackContext } from "@/lib/feedback/community-class";
import { loadFeedbackContext } from "@/lib/feedback/load-feedback-context";
import {
  FeedbackAlreadySubmittedError,
  saveFeedbackSubmission,
} from "@/lib/feedback/save-feedback";
import { parseFeedbackSubmitBody } from "@/lib/feedback/validate-submit";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseFeedbackSubmitBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    if (parsed.payload.formVariant === "community") {
      const sessionId = parsed.payload.sessionId;
      if (!sessionId) {
        return NextResponse.json({ error: "A class session is required." }, { status: 400 });
      }

      const loaded = await loadCommunityClassFeedbackContext(
        supabase,
        user.id,
        user.email,
        sessionId,
        { phone: user.phone }
      );
      if (!loaded.ok) {
        return NextResponse.json({ error: loaded.error }, { status: 400 });
      }
      if (loaded.alreadySubmitted) {
        return NextResponse.json(
          { error: "You've already submitted feedback for this class." },
          { status: 409 }
        );
      }

      const result = await saveFeedbackSubmission(
        supabase,
        user.id,
        loaded.context,
        parsed.payload
      );

      return NextResponse.json({
        ok: true,
        submissionId: result.submissionId,
        notionSynced: result.notionSynced,
        notionError: result.notionError,
      });
    }

    const context = await loadFeedbackContext(supabase, user.id, user.email, {
      lessonId: parsed.payload.lessonId,
      phone: user.phone,
      formVariant: parsed.payload.formVariant === "week1" ? "week1" : undefined,
    });

    if (parsed.payload.formVariant !== context.formVariant) {
      return NextResponse.json(
        { error: "Invalid feedback form for this lesson." },
        { status: 400 }
      );
    }

    const result = await saveFeedbackSubmission(
      supabase,
      user.id,
      context,
      parsed.payload
    );

    return NextResponse.json({
      ok: true,
      submissionId: result.submissionId,
      notionSynced: result.notionSynced,
      notionError: result.notionError,
    });
  } catch (error) {
    if (error instanceof FeedbackAlreadySubmittedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to submit feedback.",
      },
      { status: 500 }
    );
  }
}
