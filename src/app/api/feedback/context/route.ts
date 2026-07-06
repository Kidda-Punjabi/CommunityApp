import { loadFeedbackContext } from "@/lib/feedback/load-feedback-context";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const url = new URL(request.url);
  const lessonId = url.searchParams.get("lessonId");

  const context = await loadFeedbackContext(supabase, user.id, user.email, {
    lessonId,
    phone: user.phone,
  });

  return NextResponse.json({ context });
}
