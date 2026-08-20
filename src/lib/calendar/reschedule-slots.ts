import "server-only";

import { RESCHEDULE_CUTOFF_MS } from "@/lib/calendar/constants";
import type { ScheduledSessionRow } from "@/lib/calendar/types";
import {
  generateBookableSlots,
} from "@/lib/tutoring/availability/slots";
import {
  loadTutorAvailability,
  loadTutorBusyBlocks,
} from "@/lib/tutoring/availability/load-availability";
import type { BookableSlot } from "@/lib/tutoring/availability/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const RESCHEDULE_BUFFER_HOURS = RESCHEDULE_CUTOFF_MS / (60 * 60 * 1000);

function sessionDurationMinutes(startsAt: string, endsAt: string): number {
  return Math.max(
    30,
    Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000)
  );
}

async function loadSlotsForSession(
  supabase: SupabaseClient,
  session: Pick<ScheduledSessionRow, "tutor_id" | "starts_at" | "ends_at">,
  options?: { tutorBookingBufferHours?: number }
): Promise<{ slots: BookableSlot[]; error?: string }> {
  const { settings, windows, schemaReady } = await loadTutorAvailability(
    supabase,
    session.tutor_id
  );

  if (!schemaReady) {
    return { slots: [], error: "Tutor availability is not set up yet." };
  }
  if (windows.length === 0) {
    return { slots: [], error: "Your tutor has not set their availability yet." };
  }

  const fromMs = Date.now();
  const rangeStart = new Date(fromMs).toISOString();
  const rangeEnd = new Date(fromMs + 28 * 24 * 60 * 60 * 1000).toISOString();
  const busyBlocks = await loadTutorBusyBlocks(supabase, session.tutor_id, rangeStart, rangeEnd);

  const durationMinutes = sessionDurationMinutes(session.starts_at, session.ends_at);
  const effectiveSettings = {
    ...settings,
    defaultSessionMinutes: durationMinutes,
    bookingBufferHours: options?.tutorBookingBufferHours ?? RESCHEDULE_BUFFER_HOURS,
  };

  const slots = generateBookableSlots(effectiveSettings, windows, busyBlocks, {
    fromMs,
    daysAhead: 28,
  });

  return { slots: slots.slice(0, 60) };
}

export async function loadRescheduleSlotsForStudentSession(
  supabase: SupabaseClient,
  studentId: string,
  sessionId: string
): Promise<{ slots: BookableSlot[]; error?: string }> {
  const { data: session, error } = await supabase
    .from("tutor_scheduled_sessions")
    .select("id, tutor_id, student_id, cohort_id, starts_at, ends_at, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) return { slots: [], error: error.message };
  if (!session) return { slots: [], error: "Lesson not found." };
  if (session.cohort_id) return { slots: [], error: "Group lessons use alternate cohort requests." };
  if (session.student_id !== studentId) return { slots: [], error: "This lesson is not on your schedule." };
  if (session.status !== "scheduled") {
    return { slots: [], error: "This lesson is no longer scheduled." };
  }

  return loadSlotsForSession(supabase, session);
}

export async function loadRescheduleSlotsForTutorSession(
  supabase: SupabaseClient,
  tutorId: string,
  sessionStartsAt: string,
  sessionEndsAt: string
): Promise<{ slots: BookableSlot[]; error?: string }> {
  return loadSlotsForSession(
    supabase,
    {
      tutor_id: tutorId,
      starts_at: sessionStartsAt,
      ends_at: sessionEndsAt,
    },
    { tutorBookingBufferHours: 4 }
  );
}

export async function assertValidRescheduleSlot(
  supabase: SupabaseClient,
  session: Pick<
    ScheduledSessionRow,
    "id" | "tutor_id" | "student_id" | "cohort_id" | "starts_at" | "ends_at" | "status"
  >,
  studentId: string,
  startsAt: string,
  endsAt: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (session.cohort_id) {
    return { ok: false, error: "Group lessons cannot be rescheduled to a new time." };
  }
  if (session.student_id !== studentId) {
    return { ok: false, error: "This lesson is not on your schedule." };
  }
  if (!startsAt || !endsAt) {
    return { ok: false, error: "Choose a new time from your tutor's availability." };
  }

  const slotStart = new Date(startsAt).getTime();
  if (slotStart < Date.now() + RESCHEDULE_CUTOFF_MS) {
    const hours = RESCHEDULE_CUTOFF_MS / (60 * 60 * 1000);
    return {
      ok: false,
      error: `Choose a time at least ${hours} hours before the lesson would start.`,
    };
  }

  const { slots, error } = await loadRescheduleSlotsForStudentSession(
    supabase,
    studentId,
    session.id
  );
  if (error) return { ok: false, error };
  const match = slots.find((slot) => slot.startsAt === startsAt && slot.endsAt === endsAt);
  if (!match) {
    return { ok: false, error: "That time is no longer available. Please choose another slot." };
  }

  return { ok: true };
}
