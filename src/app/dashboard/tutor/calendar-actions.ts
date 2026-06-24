"use server";

import { revalidatePath } from "next/cache";
import { getRescheduleEligibility } from "@/lib/calendar/reschedule-policy";
import { createClient } from "@/lib/supabase/server";

export type CalendarActionResult = { error?: string; success?: string };

export async function disconnectGoogleCalendar(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("disconnect_tutor_google_calendar");
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/tutor/calendar");
}

export async function requestLessonReschedule(
  _prev: CalendarActionResult,
  formData: FormData
): Promise<CalendarActionResult> {
  const sessionId = String(formData.get("session_id") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const preferredTimes = String(formData.get("preferred_times") ?? "").trim();

  if (!sessionId) return { error: "Missing lesson." };
  if (!message) return { error: "Please explain why you need to reschedule." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: session, error: sessionError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !session) return { error: "Lesson not found." };

  const { data: existing } = await supabase
    .from("lesson_reschedule_requests")
    .select("*")
    .eq("session_id", sessionId)
    .eq("student_id", user.id)
    .maybeSingle();

  const eligibility = getRescheduleEligibility(session, existing ?? null);
  if (!eligibility.canRequest) {
    return { error: eligibility.lockedReason ?? "Cannot request reschedule." };
  }

  const { error } = await supabase.from("lesson_reschedule_requests").insert({
    session_id: sessionId,
    student_id: user.id,
    message,
    preferred_times: preferredTimes || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/schedule");
  return { success: "Reschedule request sent to your tutor." };
}

export async function cancelRescheduleRequest(requestId: string): Promise<CalendarActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lesson_reschedule_requests")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) return { error: error.message };

  revalidatePath("/dashboard/schedule");
  return { success: "Request cancelled." };
}

export async function resolveRescheduleRequest(
  _prev: CalendarActionResult,
  formData: FormData
): Promise<CalendarActionResult> {
  const requestId = String(formData.get("request_id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const tutorResponse = String(formData.get("tutor_response") ?? "").trim();

  if (!requestId || !["approved", "denied"].includes(decision)) {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("lesson_reschedule_requests")
    .update({
      status: decision,
      tutor_response: tutorResponse || null,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) return { error: error.message };

  revalidatePath("/dashboard/tutor/calendar");
  return {
    success:
      decision === "approved"
        ? "Request approved. Update the time in Google Calendar, then sync."
        : "Request declined.",
  };
}

export async function setSessionReschedulingAllowed(
  sessionId: string,
  allowed: boolean
): Promise<CalendarActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tutor_scheduled_sessions")
    .update({ rescheduling_allowed: allowed, updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/tutor/calendar");
  return { success: allowed ? "Rescheduling enabled." : "Rescheduling locked for this lesson." };
}
