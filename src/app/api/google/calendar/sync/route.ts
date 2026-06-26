import { NextResponse } from "next/server";
import { syncTutorGoogleCalendar } from "@/lib/calendar/sync-tutor-calendar";
import { canAccessTutorDashboard } from "@/lib/tutoring/tutor-access";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";

/** Vercel Pro allows up to 300s; first full calendar sync can be slow. */
export const maxDuration = 300;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const allowed = await canAccessTutorDashboard(supabase, user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Tutor access required." }, { status: 403 });
  }

  const { client, error: configError } = tryCreateServiceRoleClient();
  if (!client) {
    return NextResponse.json({ error: configError }, { status: 500 });
  }

  try {
    const result = await syncTutorGoogleCalendar(client, user.id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
