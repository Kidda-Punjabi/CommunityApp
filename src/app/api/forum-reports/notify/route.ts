import { deliverForumReportEmail } from "@/lib/forum/deliver-forum-report-email";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  let reportId = "";
  try {
    const json = (await request.json()) as { reportId?: unknown };
    reportId = typeof json.reportId === "string" ? json.reportId.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!reportId) return NextResponse.json({ error: "reportId is required." }, { status: 400 });

  await deliverForumReportEmail(reportId, user.id);
  return NextResponse.json({ ok: true });
}
