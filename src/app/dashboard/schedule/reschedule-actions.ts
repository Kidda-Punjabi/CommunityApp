"use server";

import { loadRescheduleSlotsForStudentSession } from "@/lib/calendar/reschedule-slots";
import { createClient } from "@/lib/supabase/server";
import type { BookableSlot } from "@/lib/tutoring/availability/types";

export async function fetchRescheduleSlotsForSession(sessionId: string): Promise<{
  slots: BookableSlot[];
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { slots: [], error: "Sign in to reschedule." };

  return loadRescheduleSlotsForStudentSession(supabase, user.id, sessionId);
}
