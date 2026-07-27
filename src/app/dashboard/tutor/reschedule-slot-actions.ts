"use server";

import { loadAlternativeSlotsForTutor } from "@/lib/admin/load-admin-reschedule-requests";
import { canAccessTutorDashboard } from "@/lib/tutoring/tutor-access";
import { createClient } from "@/lib/supabase/server";

export async function loadTutorRescheduleSlots(
  sessionStartsAt: string,
  sessionEndsAt: string
): Promise<{ slots: Awaited<ReturnType<typeof loadAlternativeSlotsForTutor>>["slots"]; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { slots: [], error: "Not signed in." };

  const allowed = await canAccessTutorDashboard(supabase, user.id);
  if (!allowed) return { slots: [], error: "Tutor access required." };

  const durationMinutes = Math.max(
    30,
    Math.round(
      (new Date(sessionEndsAt).getTime() - new Date(sessionStartsAt).getTime()) / 60000
    )
  );

  return loadAlternativeSlotsForTutor(supabase, user.id, durationMinutes);
}
