"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canAccessTutorDashboard } from "@/lib/tutoring/tutor-access";
import { isAvailabilitySchemaMissingError } from "@/lib/tutoring/availability/schema";

export type AvailabilityActionResult = { error?: string; success?: string };

async function requireTutor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await canAccessTutorDashboard(supabase, user.id))) {
    throw new Error("Unauthorized");
  }
  return { supabase, userId: user.id };
}

export async function saveTutorAvailabilitySettings(
  _prev: AvailabilityActionResult,
  formData: FormData
): Promise<AvailabilityActionResult> {
  try {
    const { supabase, userId } = await requireTutor();

    const weeklyCapacityHours = Number(formData.get("weekly_capacity_hours"));
    const defaultSessionMinutes = Number(formData.get("default_session_minutes"));
    const bookingBufferHours = Number(formData.get("booking_buffer_hours"));
    const bufferBetweenSessionsMinutes = Number(formData.get("buffer_between_sessions_minutes"));
    const oneToOneBookingEnabled = formData.get("one_to_one_booking_enabled") === "on";
    const timezone = String(formData.get("timezone") ?? "Europe/London").trim() || "Europe/London";

    if (!Number.isFinite(weeklyCapacityHours) || weeklyCapacityHours <= 0 || weeklyCapacityHours > 168) {
      return { error: "Weekly capacity must be between 1 and 168 hours." };
    }
    if (!Number.isFinite(defaultSessionMinutes) || defaultSessionMinutes < 15 || defaultSessionMinutes > 240) {
      return { error: "Session length must be between 15 and 240 minutes." };
    }
    if (!Number.isFinite(bookingBufferHours) || bookingBufferHours < 0 || bookingBufferHours > 168) {
      return { error: "Booking buffer must be between 0 and 168 hours." };
    }

    const { error } = await supabase.from("tutor_availability_settings").upsert(
      {
        tutor_id: userId,
        timezone,
        weekly_capacity_hours: weeklyCapacityHours,
        default_session_minutes: defaultSessionMinutes,
        booking_buffer_hours: bookingBufferHours,
        buffer_between_sessions_minutes: bufferBetweenSessionsMinutes,
        one_to_one_booking_enabled: oneToOneBookingEnabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tutor_id" }
    );

    if (error) {
      if (isAvailabilitySchemaMissingError(error)) {
        return { error: "Availability tables are not set up yet. Run supabase/tutor-availability-and-bookings.sql." };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/tutor/calendar");
    return { success: "Availability settings saved." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save settings." };
  }
}

export async function saveTutorAvailabilityWindows(
  _prev: AvailabilityActionResult,
  formData: FormData
): Promise<AvailabilityActionResult> {
  try {
    const { supabase, userId } = await requireTutor();

    const windows: Array<{ day_of_week: number; start_time: string; end_time: string }> = [];
    for (let day = 0; day < 7; day += 1) {
      const enabled = formData.get(`day_${day}_enabled`) === "on";
      if (!enabled) continue;
      const startTime = String(formData.get(`day_${day}_start`) ?? "").trim();
      const endTime = String(formData.get(`day_${day}_end`) ?? "").trim();
      if (!startTime || !endTime) continue;
    if (startTime >= endTime) {
      return { error: `End time must be after start time for day ${day + 1}.` };
    }
      windows.push({ day_of_week: day, start_time: startTime, end_time: endTime });
    }

    const { error: deleteError } = await supabase
      .from("tutor_availability_windows")
      .delete()
      .eq("tutor_id", userId);

    if (deleteError) {
      if (isAvailabilitySchemaMissingError(deleteError)) {
        return { error: "Availability tables are not set up yet. Run supabase/tutor-availability-and-bookings.sql." };
      }
      return { error: deleteError.message };
    }

    if (windows.length > 0) {
      const { error: insertError } = await supabase.from("tutor_availability_windows").insert(
        windows.map((window) => ({
          tutor_id: userId,
          day_of_week: window.day_of_week,
          start_time: window.start_time,
          end_time: window.end_time,
        }))
      );
      if (insertError) return { error: insertError.message };
    }

    revalidatePath("/dashboard/tutor/calendar");
    return { success: "Working hours updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save working hours." };
  }
}
