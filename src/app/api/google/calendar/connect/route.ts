import { NextResponse } from "next/server";
import { buildGoogleCalendarConnectUrl } from "@/lib/calendar/google-oauth";
import { canAccessTutorDashboard } from "@/lib/tutoring/tutor-access";
import { getPublicAppUrl } from "@/lib/app-url";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", getPublicAppUrl()));
  }

  const allowed = await canAccessTutorDashboard(supabase, user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Tutor access required." }, { status: 403 });
  }

  const url = buildGoogleCalendarConnectUrl(user.id);
  if (!url) {
    return NextResponse.json(
      {
        error:
          "Google Calendar is not configured. Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET in .env.local.",
      },
      { status: 500 }
    );
  }

  return NextResponse.redirect(url);
}
