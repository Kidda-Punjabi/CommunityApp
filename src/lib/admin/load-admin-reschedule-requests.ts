import "server-only";

import type { RescheduleRequestStatus } from "@/lib/calendar/types";
import { formatUpcomingLessonLabel } from "@/lib/calendar/session-lesson-labels";
import {
  generateBookableSlots,
} from "@/lib/tutoring/availability/slots";
import {
  loadTutorAvailability,
  loadTutorBusyBlocks,
} from "@/lib/tutoring/availability/load-availability";
import { getDisplayName } from "@/lib/profile/display-name";
import type { BookableSlot } from "@/lib/tutoring/availability/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminRescheduleRequestRow = {
  id: string;
  status: RescheduleRequestStatus;
  message: string;
  preferredTimes: string | null;
  createdAt: string;
  tutorResponse: string | null;
  resolvedAt: string | null;
  studentId: string;
  studentName: string;
  studentEmail: string | null;
  tutorId: string;
  tutorName: string;
  sessionId: string;
  sessionTitle: string;
  sessionStartsAt: string;
  sessionEndsAt: string;
  lessonLabel: string;
  cohortId: string | null;
  cohortName: string | null;
};

export async function loadAdminRescheduleRequests(
  supabase: SupabaseClient
): Promise<{ rows: AdminRescheduleRequestRow[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("lesson_reschedule_requests")
      .select(
        "id, status, message, preferred_times, created_at, tutor_response, resolved_at, student_id, session_id, tutor_scheduled_sessions(id, title, starts_at, ends_at, tutor_id, cohort_id, student_id)"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return { rows: [], error: error.message };

    const rowsRaw = data ?? [];
    const studentIds = [...new Set(rowsRaw.map((r) => r.student_id))];
    const tutorIds = [
      ...new Set(
        rowsRaw
          .map((r) => {
            const session = Array.isArray(r.tutor_scheduled_sessions)
              ? r.tutor_scheduled_sessions[0]
              : r.tutor_scheduled_sessions;
            return session?.tutor_id as string | undefined;
          })
          .filter(Boolean)
      ),
    ] as string[];
    const cohortIds = [
      ...new Set(
        rowsRaw
          .map((r) => {
            const session = Array.isArray(r.tutor_scheduled_sessions)
              ? r.tutor_scheduled_sessions[0]
              : r.tutor_scheduled_sessions;
            return session?.cohort_id as string | null | undefined;
          })
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const [{ data: profiles }, { data: cohorts }, authUsers] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, preferred_name")
        .in("id", [...new Set([...studentIds, ...tutorIds])]),
      cohortIds.length > 0
        ? supabase.from("cohorts").select("id, name").in("id", cohortIds)
        : Promise.resolve({ data: [] }),
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const cohortById = new Map((cohorts ?? []).map((c) => [c.id, c.name]));
    const emailById = new Map(
      (authUsers.data?.users ?? [])
        .filter((u) => u.email)
        .map((u) => [u.id, u.email!] as const)
    );

    const rows: AdminRescheduleRequestRow[] = [];
    for (const row of rowsRaw) {
      const session = Array.isArray(row.tutor_scheduled_sessions)
        ? row.tutor_scheduled_sessions[0]
        : row.tutor_scheduled_sessions;
      if (!session) continue;

      const student = profileById.get(row.student_id);
      const tutor = profileById.get(session.tutor_id);

      rows.push({
        id: row.id,
        status: row.status as RescheduleRequestStatus,
        message: row.message,
        preferredTimes: row.preferred_times,
        createdAt: row.created_at,
        tutorResponse: row.tutor_response,
        resolvedAt: row.resolved_at,
        studentId: row.student_id,
        studentName: getDisplayName(student ?? null) ?? "Student",
        studentEmail: emailById.get(row.student_id) ?? null,
        tutorId: session.tutor_id,
        tutorName: getDisplayName(tutor ?? null) ?? "Tutor",
        sessionId: session.id,
        sessionTitle: session.title,
        sessionStartsAt: session.starts_at,
        sessionEndsAt: session.ends_at,
        lessonLabel: formatUpcomingLessonLabel(null, session.starts_at),
        cohortId: session.cohort_id,
        cohortName: session.cohort_id ? (cohortById.get(session.cohort_id) ?? null) : null,
      });
    }

    rows.sort((a, b) => {
      const aPending = a.status === "pending" ? 0 : 1;
      const bPending = b.status === "pending" ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return b.createdAt.localeCompare(a.createdAt);
    });

    return { rows };
  } catch (e) {
    return {
      rows: [],
      error: e instanceof Error ? e.message : "Failed to load reschedule requests.",
    };
  }
}

export async function loadAlternativeSlotsForTutor(
  supabase: SupabaseClient,
  tutorId: string,
  sessionDurationMinutes?: number
): Promise<{ slots: BookableSlot[]; error?: string }> {
  try {
    const { settings, windows, schemaReady } = await loadTutorAvailability(supabase, tutorId);
    if (!schemaReady) {
      return { slots: [], error: "Tutor availability schema is not ready." };
    }
    if (windows.length === 0) {
      return { slots: [], error: "This tutor has no availability windows set." };
    }

    const fromMs = Date.now();
    const rangeEnd = new Date(fromMs + 28 * 24 * 60 * 60 * 1000).toISOString();
    const busy = await loadTutorBusyBlocks(
      supabase,
      tutorId,
      new Date(fromMs).toISOString(),
      rangeEnd
    );

    const effectiveSettings = {
      ...settings,
      defaultSessionMinutes: sessionDurationMinutes ?? settings.defaultSessionMinutes,
      // Staff resolving a request shouldn't be blocked by the student-facing 24h booking buffer
      bookingBufferHours: Math.min(settings.bookingBufferHours, 4),
    };

    const slots = generateBookableSlots(effectiveSettings, windows, busy, {
      fromMs,
      daysAhead: 28,
    }).slice(0, 40);

    return { slots };
  } catch (e) {
    return {
      slots: [],
      error: e instanceof Error ? e.message : "Failed to load alternative times.",
    };
  }
}
