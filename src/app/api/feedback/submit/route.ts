import { loadFeedbackContext } from "@/lib/feedback/load-feedback-context";
import { saveFeedbackSubmission } from "@/lib/feedback/save-feedback";
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

  const context = await loadFeedbackContext(supabase, user.id, user.email, {
    lessonId: parsed.payload.lessonId,
    phone: user.phone,
  });

  if (parsed.payload.formVariant !== context.formVariant) {
    return NextResponse.json({ error: "Invalid feedback form for this lesson." }, { status: 400 });
  }

  try {
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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to submit feedback.",
      },
      { status: 500 }
    );
  }
}
