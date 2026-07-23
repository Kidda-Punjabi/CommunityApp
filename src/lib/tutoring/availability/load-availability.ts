import type { SupabaseClient } from "@supabase/supabase-js";
import { isAvailabilitySchemaMissingError } from "./schema";
import type {
  StudentBookingContext,
  TutorAvailabilitySettings,
  TutorAvailabilityWindow,
  TutorBookingCredit,
  TutorOneToOneBooking,
} from "./types";
import { getDisplayName } from "@/lib/profile/display-name";
import { resolveStudentBookingTutor } from "./resolve-booking-tutor";

import { DEFAULT_WEEKLY_CAPACITY_HOURS } from "./constants";

const DEFAULT_SETTINGS: Omit<TutorAvailabilitySettings, "tutorId" | "updatedAt"> = {
  timezone: "Europe/London",
  weeklyCapacityHours: DEFAULT_WEEKLY_CAPACITY_HOURS,
  defaultSessionMinutes: 60,
  bookingBufferHours: 24,
  bufferBetweenSessionsMinutes: 15,
  oneToOneBookingEnabled: false,
};

function mapSettingsRow(row: Record<string, unknown>): TutorAvailabilitySettings {
  return {
    tutorId: row.tutor_id as string,
    timezone: (row.timezone as string) ?? DEFAULT_SETTINGS.timezone,
    weeklyCapacityHours: Number(row.weekly_capacity_hours ?? DEFAULT_SETTINGS.weeklyCapacityHours),
    defaultSessionMinutes: Number(row.default_session_minutes ?? DEFAULT_SETTINGS.defaultSessionMinutes),
    bookingBufferHours: Number(row.booking_buffer_hours ?? DEFAULT_SETTINGS.bookingBufferHours),
    bufferBetweenSessionsMinutes: Number(
      row.buffer_between_sessions_minutes ?? DEFAULT_SETTINGS.bufferBetweenSessionsMinutes
    ),
    oneToOneBookingEnabled: Boolean(row.one_to_one_booking_enabled),
    updatedAt: (row.updated_at as string) ?? null,
  };
}

function mapWindowRow(row: Record<string, unknown>): TutorAvailabilityWindow {
  return {
    id: row.id as string,
    tutorId: row.tutor_id as string,
    dayOfWeek: Number(row.day_of_week),
    startTime: String(row.start_time).slice(0, 5),
    endTime: String(row.end_time).slice(0, 5),
  };
}

export async function loadTutorAvailability(
  supabase: SupabaseClient,
  tutorId: string
): Promise<{
  settings: TutorAvailabilitySettings;
  windows: TutorAvailabilityWindow[];
  schemaReady: boolean;
}> {
  const [{ data: settingsRow, error: settingsError }, { data: windowRows, error: windowsError }] =
    await Promise.all([
      supabase.from("tutor_availability_settings").select("*").eq("tutor_id", tutorId).maybeSingle(),
      supabase
        .from("tutor_availability_windows")
        .select("*")
        .eq("tutor_id", tutorId)
        .order("day_of_week")
        .order("start_time"),
    ]);

  if (isAvailabilitySchemaMissingError(settingsError ?? {}) || isAvailabilitySchemaMissingError(windowsError ?? {})) {
    return {
      settings: { tutorId, updatedAt: null, ...DEFAULT_SETTINGS },
      windows: [],
      schemaReady: false,
    };
  }

  if (settingsError) throw settingsError;
  if (windowsError) throw windowsError;

  return {
    schemaReady: true,
    settings: settingsRow
      ? mapSettingsRow(settingsRow)
      : { tutorId, updatedAt: null, ...DEFAULT_SETTINGS },
    windows: (windowRows ?? []).map(mapWindowRow),
  };
}

export async function loadStudentBookingContext(
  supabase: SupabaseClient,
  studentId: string
): Promise<{ context: StudentBookingContext | null; schemaReady: boolean }> {
  const availableCredits = await countAvailableBookingCredits(supabase, studentId);
  const resolved = await resolveStudentBookingTutor(supabase, studentId);

  if (!resolved) {
    if (availableCredits < 1) {
      return { context: null, schemaReady: true };
    }

    return {
      schemaReady: true,
      context: {
        tutorId: "",
        tutorName: "Your tutor",
        enrollmentId: null,
        courseId: null,
        bookingEnabled: false,
        settings: null,
        availableCredits,
        tutorUnresolved: true,
      },
    };
  }

  const availability = await loadTutorAvailability(supabase, resolved.tutorId);
  if (!availability.schemaReady) {
    return { context: null, schemaReady: false };
  }

  const bookingEnabled =
    resolved.bookingEnabled &&
    availability.settings.oneToOneBookingEnabled &&
    availability.windows.length > 0;

  return {
    schemaReady: true,
    context: {
      tutorId: resolved.tutorId,
      tutorName: resolved.tutorName,
      enrollmentId: resolved.enrollmentId,
      courseId: resolved.courseId,
      bookingEnabled,
      settings: availability.settings,
      availableCredits,
    },
  };
}

export async function countAvailableBookingCredits(
  supabase: SupabaseClient,
  studentId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("tutor_one_to_one_booking_credits")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("status", "available");

  if (error) {
    if (isAvailabilitySchemaMissingError(error)) return 0;
    throw error;
  }

  return count ?? 0;
}

export async function loadAvailableBookingCredits(
  supabase: SupabaseClient,
  studentId: string
): Promise<{ credits: TutorBookingCredit[]; schemaReady: boolean }> {
  const { data, error } = await supabase
    .from("tutor_one_to_one_booking_credits")
    .select("id, purchased_at, status")
    .eq("student_id", studentId)
    .eq("status", "available")
    .order("purchased_at", { ascending: true });

  if (error) {
    if (isAvailabilitySchemaMissingError(error)) {
      return { credits: [], schemaReady: false };
    }
    throw error;
  }

  return {
    schemaReady: true,
    credits: (data ?? []).map((row) => ({
      id: row.id as string,
      purchasedAt: row.purchased_at as string,
      status: row.status as TutorBookingCredit["status"],
    })),
  };
}

export async function loadTutorPendingBookings(
  supabase: SupabaseClient,
  tutorId: string
): Promise<{ bookings: Array<TutorOneToOneBooking & { studentName: string }>; schemaReady: boolean }> {
  const { data, error } = await supabase
    .from("tutor_one_to_one_bookings")
    .select("*")
    .eq("tutor_id", tutorId)
    .in("status", ["confirmed"])
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    if (isAvailabilitySchemaMissingError(error)) {
      return { bookings: [], schemaReady: false };
    }
    throw error;
  }

  const studentIds = [...new Set((data ?? []).map((row) => row.student_id as string))];
  const { data: profiles } =
    studentIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, preferred_name")
          .in("id", studentIds)
      : { data: [] };

  const nameById = new Map(
    (profiles ?? []).map((profile) => [profile.id, getDisplayName(profile) ?? "Student"])
  );

  return {
    schemaReady: true,
    bookings: (data ?? []).map((row) => ({
      id: row.id as string,
      tutorId: row.tutor_id as string,
      studentId: row.student_id as string,
      startsAt: row.starts_at as string,
      endsAt: row.ends_at as string,
      status: row.status as TutorOneToOneBooking["status"],
      notes: (row.notes as string) ?? null,
      createdAt: row.created_at as string,
      studentName: nameById.get(row.student_id as string) ?? "Student",
    })),
  };
}

export async function loadStudentBookings(
  supabase: SupabaseClient,
  studentId: string
): Promise<{ bookings: TutorOneToOneBooking[]; schemaReady: boolean }> {
  const { data, error } = await supabase
    .from("tutor_one_to_one_bookings")
    .select("*")
    .eq("student_id", studentId)
    .in("status", ["confirmed"])
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    if (isAvailabilitySchemaMissingError(error)) {
      return { bookings: [], schemaReady: false };
    }
    throw error;
  }

  return {
    schemaReady: true,
    bookings: (data ?? []).map((row) => ({
      id: row.id as string,
      tutorId: row.tutor_id as string,
      studentId: row.student_id as string,
      startsAt: row.starts_at as string,
      endsAt: row.ends_at as string,
      status: row.status as TutorOneToOneBooking["status"],
      notes: (row.notes as string) ?? null,
      createdAt: row.created_at as string,
    })),
  };
}

export async function loadTutorBusyBlocks(
  supabase: SupabaseClient,
  tutorId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<Array<{ startsAt: string; endsAt: string }>> {
  const [{ data: sessions }, { data: bookings }] = await Promise.all([
    supabase
      .from("tutor_scheduled_sessions")
      .select("starts_at, ends_at")
      .eq("tutor_id", tutorId)
      .eq("status", "scheduled")
      .lt("starts_at", rangeEnd)
      .gt("ends_at", rangeStart),
    supabase
      .from("tutor_one_to_one_bookings")
      .select("starts_at, ends_at")
      .eq("tutor_id", tutorId)
      .in("status", ["confirmed", "pending_payment"])
      .lt("starts_at", rangeEnd)
      .gt("ends_at", rangeStart),
  ]);

  return [
    ...(sessions ?? []).map((row) => ({
      startsAt: row.starts_at as string,
      endsAt: row.ends_at as string,
    })),
    ...(bookings ?? []).map((row) => ({
      startsAt: row.starts_at as string,
      endsAt: row.ends_at as string,
    })),
  ];
}
