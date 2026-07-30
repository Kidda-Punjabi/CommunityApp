"use server";

import { loadRescheduleSlotsForTutorSession } from "@/lib/calendar/reschedule-slots";
import { canAccessTutorDashboard } from "@/lib/tutoring/tutor-access";
import { createClient } from "@/lib/supabase/server";

export async function loadTutorRescheduleSlots(
  sessionStartsAt: string,
  sessionEndsAt: string
): Promise<{ slots: Awaited<ReturnType<typeof loadRescheduleSlotsForTutorSession>>["slots"]; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { slots: [], error: "Not signed in." };

  const allowed = await canAccessTutorDashboard(supabase, user.id);
  if (!allowed) return { slots: [], error: "Tutor access required." };

  return loadRescheduleSlotsForTutorSession(supabase, user.id, sessionStartsAt, sessionEndsAt);
}
