import "server-only";

import {
  COHORT_CHANGE_FEE_STATUSES,
  COHORT_CHANGE_STATUSES,
  type AdminCohortChangeRequestRow,
  type AdminCourseOption,
  type CohortChangeFeeStatus,
  type CohortChangeRequestStatus,
  type StudentCourseEnrollmentOption,
} from "@/lib/admin/cohort-change-request-types";
import { getStaffFacingName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";

export type {
  AdminCohortChangeRequestRow,
  AdminCourseOption,
  CohortChangeFeeStatus,
  CohortChangeRequestStatus,
  StudentCourseEnrollmentOption,
} from "@/lib/admin/cohort-change-request-types";
export {
  COHORT_CHANGE_FEE_STATUSES,
  COHORT_CHANGE_STATUSES,
} from "@/lib/admin/cohort-change-request-types";

function isStatus(value: string): value is CohortChangeRequestStatus {
  return (COHORT_CHANGE_STATUSES as readonly string[]).includes(value);
}

function isFeeStatus(value: string): value is CohortChangeFeeStatus {
  return (COHORT_CHANGE_FEE_STATUSES as readonly string[]).includes(value);
}

function asFeeAmount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isMissingTableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("cohort_change_requests") &&
    (lower.includes("schema cache") ||
      lower.includes("does not exist") ||
      lower.includes("could not find the table"))
  );
}

export async function loadAdminCourses(
  supabase: SupabaseClient
): Promise<{ courses: AdminCourseOption[]; error?: string }> {
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, display_order")
    .order("display_order", { ascending: true });

  if (error) return { courses: [], error: error.message };

  return {
    courses: (data ?? []).map((row) => ({
      id: row.id as string,
      name: (row.name as string) || "Untitled course",
    })),
  };
}

export async function loadStudentCourseEnrollments(
  supabase: SupabaseClient,
  studentId: string
): Promise<{ enrollments: StudentCourseEnrollmentOption[]; error?: string }> {
  const { data, error } = await supabase
    .from("course_enrollments")
    .select("id, course_id, created_at")
    .eq("user_id", studentId)
    .order("created_at", { ascending: false });

  if (error) return { enrollments: [], error: error.message };

  const courseIds = [...new Set((data ?? []).map((row) => row.course_id as string))];
  const { data: courses } =
    courseIds.length > 0
      ? await supabase.from("courses").select("id, name").in("id", courseIds)
      : { data: [] };

  const nameById = new Map((courses ?? []).map((row) => [row.id as string, row.name as string]));

  return {
    enrollments: (data ?? []).map((row) => ({
      id: row.id as string,
      courseId: row.course_id as string,
      courseName: nameById.get(row.course_id as string) ?? "Unknown course",
    })),
  };
}

async function hydrateRows(
  supabase: SupabaseClient,
  rowsRaw: Array<Record<string, unknown>>
): Promise<AdminCohortChangeRequestRow[]> {
  const studentIds = [...new Set(rowsRaw.map((row) => row.student_id as string).filter(Boolean))];
  const courseIds = [
    ...new Set(
      rowsRaw.flatMap((row) => [row.from_course_id, row.to_course_id]).filter(Boolean)
    ),
  ] as string[];

  const [{ data: profiles }, { data: courses }, authUsers] = await Promise.all([
    studentIds.length > 0
      ? supabase.from("profiles").select("id, full_name, preferred_name").in("id", studentIds)
      : Promise.resolve({ data: [] }),
    courseIds.length > 0
      ? supabase.from("courses").select("id, name").in("id", courseIds)
      : Promise.resolve({ data: [] }),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const profileById = new Map((profiles ?? []).map((row) => [row.id as string, row]));
  const courseNameById = new Map(
    (courses ?? []).map((row) => [row.id as string, (row.name as string) || "Untitled course"])
  );
  const emailById = new Map(
    (authUsers.data?.users ?? [])
      .filter((user) => user.email)
      .map((user) => [user.id, user.email as string])
  );

  return rowsRaw.map((row) => {
    const studentId = row.student_id as string;
    const fromCourseId = (row.from_course_id as string | null) ?? null;
    const toCourseId = (row.to_course_id as string | null) ?? null;
    const statusRaw = (row.status as string) ?? "pending";
    const feeStatusRaw = (row.fee_status as string) ?? "unpaid";
    const profile = profileById.get(studentId);
    const email = emailById.get(studentId) ?? null;

    return {
      id: row.id as string,
      studentId,
      studentName: getStaffFacingName(profile) ?? email ?? "Student",
      studentEmail: email,
      courseEnrollmentId: (row.course_enrollment_id as string | null) ?? null,
      fromCourseId,
      fromCourseName: fromCourseId ? (courseNameById.get(fromCourseId) ?? "Unknown course") : "Not set",
      toCourseId,
      toCourseName: toCourseId ? (courseNameById.get(toCourseId) ?? "Unknown course") : "Not set",
      reason: (row.reason as string | null) ?? null,
      feeAmount: asFeeAmount(row.fee_amount),
      feeStatus: isFeeStatus(feeStatusRaw) ? feeStatusRaw : "unpaid",
      status: isStatus(statusRaw) ? statusRaw : "pending",
      adminNotes: (row.admin_notes as string | null) ?? null,
      resolvedBy: (row.resolved_by as string | null) ?? null,
      resolvedAt: (row.resolved_at as string | null) ?? null,
      createdAt: row.created_at as string,
    };
  });
}

export async function loadAdminCohortChangeRequests(
  supabase: SupabaseClient
): Promise<{ rows: AdminCohortChangeRequestRow[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("cohort_change_requests")
      .select(
        "id, student_id, course_enrollment_id, from_course_id, to_course_id, reason, fee_amount, fee_status, status, admin_notes, resolved_by, resolved_at, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      if (isMissingTableError(error.message)) {
        return {
          rows: [],
          error: "cohort_change_requests is not applied yet. Run supabase/cohort-change-requests.sql.",
        };
      }
      return { rows: [], error: error.message };
    }

    return { rows: await hydrateRows(supabase, (data ?? []) as Array<Record<string, unknown>>) };
  } catch (e) {
    return {
      rows: [],
      error: e instanceof Error ? e.message : "Failed to load cohort switch requests.",
    };
  }
}

export async function loadAdminCohortChangeRequest(
  supabase: SupabaseClient,
  requestId: string
): Promise<{ row: AdminCohortChangeRequestRow | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("cohort_change_requests")
      .select(
        "id, student_id, course_enrollment_id, from_course_id, to_course_id, reason, fee_amount, fee_status, status, admin_notes, resolved_by, resolved_at, created_at"
      )
      .eq("id", requestId)
      .maybeSingle();

    if (error) return { row: null, error: error.message };
    if (!data) return { row: null, error: "Request not found." };

    const [row] = await hydrateRows(supabase, [data as Record<string, unknown>]);
    return { row: row ?? null };
  } catch (e) {
    return {
      row: null,
      error: e instanceof Error ? e.message : "Failed to load request.",
    };
  }
}

export async function countPendingCohortChangeRequests(
  supabase: SupabaseClient
): Promise<{ count: number; error?: string }> {
  try {
    const { count, error } = await supabase
      .from("cohort_change_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if (error) {
      if (isMissingTableError(error.message)) return { count: 0 };
      return { count: 0, error: error.message };
    }
    return { count: count ?? 0 };
  } catch (e) {
    return {
      count: 0,
      error: e instanceof Error ? e.message : "Failed to count cohort switch requests.",
    };
  }
}
